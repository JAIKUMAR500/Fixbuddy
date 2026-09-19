import { LedgerEntry } from "../../models/LedgerEntry.js";
import { PaymentOrder } from "../../models/PaymentOrder.js";
import { WebhookEvent } from "../../models/WebhookEvent.js";
import { Request } from "../../models/Request.js";
import { User } from "../../models/User.js";
import { getSettings } from "../../models/PlatformSettings.js";
import { isDuplicateKeyError } from "../../utils/jobLock.js";
import { httpError } from "../../utils/asyncHandler.js";
import { PaymentService } from "./PaymentService.js";
import { DevelopmentPaymentService } from "./DevelopmentPaymentService.js";
import { FINANCE_STATUS, LIVE_LEDGER_TYPES, PRODUCTION_LABEL, commissionPercentFrom } from "./config.js";
import { commissionPaise, netPaise, paiseToRupees, rupeesToPaise } from "./money.js";
import { GATEWAYS, gatewayConfig } from "./gatewayConfig.js";
import { gatewayClientFor } from "./gatewayClient.js";
import { verifyWebhookSignature } from "./signature.js";

const PAYABLE_STATUSES = ["arrived", "otp_verified", "in_progress", "completed"];

/** Price comes from the job record, never from the request body. */
export function authoritativeAmountPaise(request) {
  const quoted = rupeesToPaise(request.workerQuote || request.estimatedAmount || 0);
  const stored = Math.max(0, Math.trunc(Number(request.finance?.jobPricePaise) || 0));
  return quoted || stored;
}

export class ProductionPaymentService extends PaymentService {
  constructor({ config = gatewayConfig(), client } = {}) {
    super();
    this.config = config;
    this.client = client || gatewayClientFor(config);
    // Cancellation compensation policy is shared with development.
    this.policy = new DevelopmentPaymentService();
  }

  get mode() {
    return "production";
  }

  get provider() {
    return this.config.provider;
  }

  quote(request, settings) {
    const jobPrice = authoritativeAmountPaise(request);
    const percent = commissionPercentFrom(settings);
    const commission = commissionPaise(jobPrice, percent);
    return {
      jobPricePaise: jobPrice,
      commissionPercent: percent,
      commissionPaise: commission,
      workerGrossPaise: jobPrice,
      workerNetPaise: netPaise(jobPrice, commission),
    };
  }

  /**
   * Creates (or returns) the open gateway order for a job.
   * The caller must already be the job's customer.
   */
  async createOrder({ request, customerId }) {
    if (String(request.customerId) !== String(customerId)) {
      throw httpError(403, "You do not have access to this job.");
    }
    if (!PAYABLE_STATUSES.includes(String(request.status))) {
      throw httpError(409, "This job is not ready for payment yet.");
    }
    if (request.paymentStatus === "collected" || request.finance?.settled) {
      throw httpError(409, "This job is already paid.");
    }

    const settings = await getSettings();
    const calc = this.quote(request, settings);
    if (calc.jobPricePaise < 1) throw httpError(400, "This job has no payable amount yet.");

    const existing = await PaymentOrder.findOne({ requestId: request._id, status: "created" }).lean();
    if (existing && existing.amountPaise === calc.jobPricePaise) {
      return {
        orderId: existing.orderId,
        amountPaise: existing.amountPaise,
        currency: existing.currency,
        provider: existing.provider,
        reused: true,
      };
    }
    if (existing) {
      // The quote changed; retire the stale order before opening a new one.
      await PaymentOrder.updateOne({ _id: existing._id }, { $set: { status: "expired" } });
    }

    const created = await this.client.createOrder({
      amountPaise: calc.jobPricePaise,
      currency: this.config.currency,
      receipt: String(request.code || request._id),
      notes: { requestId: String(request._id) },
    });

    if (Number(created.amountPaise) !== calc.jobPricePaise) {
      throw httpError(502, "Payment gateway returned a different amount.");
    }

    try {
      await PaymentOrder.create({
        requestId: request._id,
        customerId: request.customerId,
        providerId: request.providerId || null,
        provider: this.config.provider,
        orderId: created.orderId,
        amountPaise: calc.jobPricePaise,
        currency: created.currency,
        status: "created",
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      const again = await PaymentOrder.findOne({ requestId: request._id, status: "created" }).lean();
      if (again) {
        return {
          orderId: again.orderId,
          amountPaise: again.amountPaise,
          currency: again.currency,
          provider: again.provider,
          reused: true,
        };
      }
      throw err;
    }

    await Request.updateOne(
      { _id: request._id },
      {
        $set: {
          "finance.mode": "production",
          "finance.status": FINANCE_STATUS.AWAITING_PAYMENT,
          "finance.jobPricePaise": calc.jobPricePaise,
          "finance.commissionPercent": calc.commissionPercent,
          "finance.commissionPaise": calc.commissionPaise,
          "finance.workerGrossPaise": calc.workerGrossPaise,
          "finance.workerNetPaise": calc.workerNetPaise,
        },
      }
    );

    return {
      orderId: created.orderId,
      amountPaise: calc.jobPricePaise,
      currency: created.currency,
      provider: this.config.provider,
      clientSecret: created.clientSecret,
      reused: false,
    };
  }

  /** Pulls the gateway order id, payment id, and amount out of a webhook body. */
  parseWebhook(payload) {
    if (this.config.provider === GATEWAYS.RAZORPAY) {
      const entity = payload?.payload?.payment?.entity || {};
      return {
        eventId: String(payload?.id || entity.id || ""),
        eventType: String(payload?.event || ""),
        orderId: String(entity.order_id || ""),
        paymentId: String(entity.id || ""),
        amountPaise: Number(entity.amount || 0),
        captured: payload?.event === "payment.captured" || entity.status === "captured",
        failed: payload?.event === "payment.failed",
      };
    }
    const object = payload?.data?.object || {};
    return {
      eventId: String(payload?.id || ""),
      eventType: String(payload?.type || ""),
      orderId: String(object.id || ""),
      paymentId: String(object.latest_charge || object.id || ""),
      amountPaise: Number(object.amount_received || object.amount || 0),
      captured: payload?.type === "payment_intent.succeeded",
      failed: payload?.type === "payment_intent.payment_failed",
    };
  }

  /**
   * Verifies, de-duplicates, and applies a gateway webhook.
   * @returns {{ status: "ignored"|"duplicate"|"failed"|"captured", ... }}
   */
  async handleWebhook({ rawBody, headers }) {
    const verdict = verifyWebhookSignature({
      provider: this.config.provider,
      rawBody,
      headers,
      secret: this.config.webhookSecret,
    });
    if (!verdict.ok) throw httpError(400, "Invalid webhook signature.");

    let payload;
    try {
      payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
    } catch {
      throw httpError(400, "Invalid webhook payload.");
    }

    const event = this.parseWebhook(payload);
    if (!event.eventId) throw httpError(400, "Webhook is missing an event id.");
    if (!event.captured && !event.failed) return { status: "ignored", eventType: event.eventType };

    const order = await PaymentOrder.findOne({ orderId: event.orderId });
    if (!order) throw httpError(404, "Unknown payment order.");

    // Idempotency gate: a replayed delivery cannot reach the ledger twice.
    try {
      await WebhookEvent.create({
        provider: this.config.provider,
        eventId: event.eventId,
        eventType: event.eventType,
        requestId: order.requestId,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      return { status: "duplicate", eventType: event.eventType, requestId: String(order.requestId) };
    }

    if (event.failed) {
      await PaymentOrder.updateOne(
        { _id: order._id, status: "created" },
        { $set: { status: "failed", failureReason: String(event.eventType || "failed").slice(0, 120) } }
      );
      await Request.updateOne({ _id: order.requestId }, { $set: { "finance.status": FINANCE_STATUS.FAILED } });
      return { status: "failed", requestId: String(order.requestId) };
    }

    // Trust only the amount recorded server side when the order was created.
    if (Number(event.amountPaise) !== order.amountPaise) {
      throw httpError(409, "Paid amount does not match the recorded order amount.");
    }

    const settled = await this.#settleCapturedOrder(order, event);
    return { status: "captured", requestId: String(order.requestId), ...settled };
  }

  async #settleCapturedOrder(order, event) {
    const request = await Request.findById(order.requestId);
    if (!request) throw httpError(404, "Request not found.");

    const settings = await getSettings();
    const calc = this.quote(request, settings);
    const at = new Date();

    const entries = [
      {
        type: LIVE_LEDGER_TYPES.JOB_PAYMENT,
        amountPaise: order.amountPaise,
        userId: request.providerId,
        counterpartyId: request.customerId,
        note: `${PRODUCTION_LABEL}. Job payment captured.`,
      },
      {
        type: LIVE_LEDGER_TYPES.COMMISSION,
        amountPaise: calc.commissionPaise,
        userId: request.providerId,
        counterpartyId: null,
        note: `${PRODUCTION_LABEL}. Platform fee ${calc.commissionPercent}%.`,
      },
      {
        type: LIVE_LEDGER_TYPES.WORKER_EARNING,
        amountPaise: calc.workerNetPaise,
        userId: request.providerId,
        counterpartyId: request.customerId,
        note: `${PRODUCTION_LABEL}. Worker credit.`,
      },
    ];

    for (const entry of entries) {
      try {
        await LedgerEntry.create({
          code: `PAY-${order.orderId}-${entry.type}`,
          requestId: request._id,
          userId: entry.userId || null,
          counterpartyId: entry.counterpartyId || null,
          type: entry.type,
          amountPaise: entry.amountPaise,
          status: FINANCE_STATUS.CAPTURED,
          financialMode: "production",
          note: entry.note,
        });
      } catch (err) {
        // Unique {requestId, type} makes a re-run a no-op instead of a re-credit.
        if (!isDuplicateKeyError(err)) throw err;
      }
    }

    await PaymentOrder.updateOne(
      { _id: order._id },
      { $set: { status: "paid", gatewayPaymentId: event.paymentId, paidAt: at } }
    );

    const claimed = await Request.findOneAndUpdate(
      { _id: request._id, "finance.settled": { $ne: true } },
      {
        $set: {
          paymentStatus: "collected",
          paymentCollectedAt: at,
          "finance.mode": "production",
          "finance.status": FINANCE_STATUS.CAPTURED,
          "finance.jobPricePaise": calc.jobPricePaise,
          "finance.commissionPercent": calc.commissionPercent,
          "finance.commissionPaise": calc.commissionPaise,
          "finance.workerGrossPaise": calc.workerGrossPaise,
          "finance.workerNetPaise": calc.workerNetPaise,
          "finance.calculatedAt": at,
          "finance.settled": true,
          "finance.settlementRef": event.paymentId,
        },
      },
      { new: true }
    );

    if (claimed && !claimed.finance?.walletCredited && claimed.providerId && calc.workerNetPaise > 0) {
      await User.updateOne(
        { _id: claimed.providerId },
        { $inc: { simulatedWalletPaise: calc.workerNetPaise, walletBalance: paiseToRupees(calc.workerNetPaise) } }
      );
      await Request.updateOne({ _id: claimed._id }, { $set: { "finance.walletCredited": true } });
    }

    return {
      duplicate: !claimed,
      jobPricePaise: calc.jobPricePaise,
      commissionPaise: calc.commissionPaise,
      workerNetPaise: calc.workerNetPaise,
    };
  }

  async settleJob(request) {
    // Live settlement is driven by the verified webhook, not by an API call.
    const fresh = await Request.findById(request._id).lean();
    if (fresh?.finance?.settled) return { ...fresh.finance, duplicate: true };
    throw httpError(409, "Live payments settle from the gateway webhook. Ask the customer to pay online.");
  }

  async simulateCancellation(request, options) {
    return this.policy.simulateCancellation(request, options);
  }
}
