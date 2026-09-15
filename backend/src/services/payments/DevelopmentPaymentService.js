import { LedgerEntry } from "../../models/LedgerEntry.js";
import { Request } from "../../models/Request.js";
import { User } from "../../models/User.js";
import { Crew } from "../../models/Crew.js";
import { Cancellation } from "../../models/Cancellation.js";
import { CancellationRecord } from "../../models/CancellationRecord.js";
import { getSettings } from "../../models/PlatformSettings.js";
import { isDuplicateKeyError } from "../../utils/jobLock.js";
import { PaymentService } from "./PaymentService.js";
import {
  CANCEL_SCENARIOS,
  COMPENSATION_POLICY,
  FINANCIAL_MODE,
  FINANCE_STATUS,
  LEDGER_TYPES,
  SIMULATION_LABEL,
  commissionPercentFrom,
  travelCompensationPaise,
} from "./config.js";
import { commissionPaise, netPaise, paiseToRupees, rupeesToPaise } from "./money.js";

function jobPricePaiseOf(request) {
  const quoted = rupeesToPaise(request.workerQuote || request.estimatedAmount || 0);
  const stored = Math.max(0, Math.trunc(Number(request.finance?.jobPricePaise) || 0));
  return quoted || stored;
}

function snapshotFrom(request, extra = {}) {
  const f = request.finance || {};
  return {
    financialMode: FINANCIAL_MODE,
    label: SIMULATION_LABEL,
    status: f.status || FINANCE_STATUS.NOT_APPLICABLE,
    jobPricePaise: f.jobPricePaise || 0,
    commissionPercent: f.commissionPercent || 0,
    commissionPaise: f.commissionPaise || 0,
    workerGrossPaise: f.workerGrossPaise || 0,
    workerNetPaise: f.workerNetPaise || 0,
    calculatedAt: f.calculatedAt || null,
    jobPriceRupees: paiseToRupees(f.jobPricePaise || 0),
    commissionRupees: paiseToRupees(f.commissionPaise || 0),
    workerGrossRupees: paiseToRupees(f.workerGrossPaise || 0),
    workerNetRupees: paiseToRupees(f.workerNetPaise || 0),
    ...extra,
  };
}

async function nextLedgerCode() {
  return `SIM-${Date.now()}-${Math.trunc(Math.random() * 1e9)}`;
}

async function insertLedger({ requestId, userId, counterpartyId, type, amountPaise, status, note }) {
  const paise = Math.max(0, Math.trunc(Number(amountPaise) || 0));
  try {
    return await LedgerEntry.create({
      code: await nextLedgerCode(),
      requestId,
      userId: userId || null,
      counterpartyId: counterpartyId || null,
      type,
      amountPaise: paise,
      status,
      financialMode: FINANCIAL_MODE,
      note: note || SIMULATION_LABEL,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    return LedgerEntry.findOne({ requestId, type });
  }
}

function cancelScenario(status, cancelledBy) {
  if (cancelledBy === "admin") return CANCEL_SCENARIOS.ADMIN_OR_MUTUAL;
  const pending = ["matching", "open", "requested"].includes(status);
  const accepted = ["accepted", "scheduled"].includes(status);
  const travelling = status === "on_the_way";
  const arrived = ["arrived", "otp_verified"].includes(status);
  const started = status === "in_progress";
  if (cancelledBy === "customer" || cancelledBy === "business") {
    if (pending) return CANCEL_SCENARIOS.CUSTOMER_BEFORE_ACCEPT;
    if (accepted) return CANCEL_SCENARIOS.CUSTOMER_AFTER_ACCEPT;
    if (travelling || arrived) return CANCEL_SCENARIOS.CUSTOMER_AFTER_ARRIVE;
    if (started) return CANCEL_SCENARIOS.CUSTOMER_AFTER_START;
    return CANCEL_SCENARIOS.CUSTOMER_AFTER_ACCEPT;
  }
  if (arrived || started || travelling) return CANCEL_SCENARIOS.WORKER_AFTER_ARRIVE;
  return CANCEL_SCENARIOS.WORKER_AFTER_ACCEPT;
}

export class DevelopmentPaymentService extends PaymentService {
  get mode() {
    return FINANCIAL_MODE;
  }

  quote(request, settings) {
    const jobPrice = jobPricePaiseOf(request);
    const percent = commissionPercentFrom(settings);
    const commission = commissionPaise(jobPrice, percent);
    const net = netPaise(jobPrice, commission);
    return {
      jobPricePaise: jobPrice,
      commissionPercent: percent,
      commissionPaise: commission,
      workerGrossPaise: jobPrice,
      workerNetPaise: net,
    };
  }

  compensationQuote(status, cancelledBy, settings, parties = {}) {
    const scenario = cancelScenario(status, cancelledBy);
    const rule = COMPENSATION_POLICY[scenario] || COMPENSATION_POLICY[CANCEL_SCENARIOS.ADMIN_OR_MUTUAL];
    let amountPaise = Math.max(0, Math.trunc(Number(rule.amountPaise) || 0));
    if (rule.useTravelSettings) amountPaise = travelCompensationPaise(settings);
    const payerId = rule.payer === "customer" ? parties.customerId : rule.payer === "worker" ? parties.workerId : null;
    const receiverId = rule.receiver === "worker" ? parties.workerId : rule.receiver === "customer" ? parties.customerId : null;
    const hasMoney = amountPaise > 0 && payerId && receiverId;
    return {
      scenario,
      amountPaise: hasMoney ? amountPaise : 0,
      payer: rule.payer || null,
      receiver: rule.receiver || null,
      payerId: hasMoney ? payerId : null,
      receiverId: hasMoney ? receiverId : null,
      status: hasMoney ? FINANCE_STATUS.SIMULATED : FINANCE_STATUS.NOT_APPLICABLE,
    };
  }

  async settleJob(request) {
    const fresh = await Request.findById(request._id);
    if (!fresh) return snapshotFrom(request);
    if (fresh.finance?.settled) {
      return snapshotFrom(fresh, { duplicate: true });
    }
    const settings = await getSettings();
    const calc = this.quote(fresh, settings);
    const at = new Date();

    const payment = await insertLedger({
      requestId: fresh._id,
      userId: fresh.providerId,
      counterpartyId: fresh.customerId,
      type: LEDGER_TYPES.JOB_PAYMENT,
      amountPaise: calc.jobPricePaise,
      status: FINANCE_STATUS.SIMULATED,
      note: `${SIMULATION_LABEL}. Simulated job payment.`,
    });
    await insertLedger({
      requestId: fresh._id,
      userId: fresh.providerId,
      counterpartyId: null,
      type: LEDGER_TYPES.COMMISSION,
      amountPaise: calc.commissionPaise,
      status: FINANCE_STATUS.SIMULATED,
      note: `${SIMULATION_LABEL}. Simulated FixBuddy commission ${calc.commissionPercent}%.`,
    });
    await insertLedger({
      requestId: fresh._id,
      userId: fresh.providerId,
      counterpartyId: fresh.customerId,
      type: LEDGER_TYPES.WORKER_EARNING,
      amountPaise: calc.workerNetPaise,
      status: FINANCE_STATUS.SIMULATED,
      note: `${SIMULATION_LABEL}. Simulated worker net earning.`,
    });

    const claimed = await Request.findOneAndUpdate(
      { _id: fresh._id, "finance.settled": { $ne: true } },
      {
        $set: {
          "finance.mode": FINANCIAL_MODE,
          "finance.status": FINANCE_STATUS.SIMULATED,
          "finance.jobPricePaise": calc.jobPricePaise,
          "finance.commissionPercent": calc.commissionPercent,
          "finance.commissionPaise": calc.commissionPaise,
          "finance.workerGrossPaise": calc.workerGrossPaise,
          "finance.workerNetPaise": calc.workerNetPaise,
          "finance.calculatedAt": at,
          "finance.settled": true,
          "finance.settlementRef": payment?.code || "",
        },
      },
      { new: true }
    );

    if (!claimed) {
      const again = await Request.findById(fresh._id);
      return snapshotFrom(again, { duplicate: true });
    }

    if (!claimed.finance?.walletCredited) {
      await this.#creditSimulatedWallet(claimed, calc);
      await Request.updateOne({ _id: claimed._id }, { $set: { "finance.walletCredited": true } });
      claimed.finance.walletCredited = true;
    }

    return snapshotFrom(claimed);
  }

  async #creditSimulatedWallet(request, calc) {
    if (request.crewId && (request.crewMemberIds || []).length) {
      const crew = await Crew.findById(request.crewId).lean();
      if (crew) {
        const active = (crew.members || []).filter((m) => m.status === "active");
        const n = Math.max(1, active.length);
        let remaining = calc.workerNetPaise;
        for (let i = 0; i < active.length; i++) {
          const share = i === active.length - 1 ? remaining : Math.trunc(calc.workerNetPaise / n);
          remaining -= share;
          if (share > 0) {
            await User.updateOne(
              { _id: active[i].userId },
              { $inc: { simulatedWalletPaise: share, walletBalance: paiseToRupees(share) } }
            );
          }
        }
        await Crew.updateOne({ _id: crew._id }, { $inc: { completedJobs: 1 } });
        return;
      }
    }
    if (request.providerId && calc.workerNetPaise > 0) {
      await User.updateOne(
        { _id: request.providerId },
        { $inc: { simulatedWalletPaise: calc.workerNetPaise, walletBalance: paiseToRupees(calc.workerNetPaise) } }
      );
    }
  }

  async simulateCancellation(request, { cancelledBy, reason, actorId }) {
    if (request.cancellationFinance?.recorded) {
      return {
        duplicate: true,
        finance: request.cancellationFinance,
        compensationPaise: request.cancellationFinance.amountPaise || 0,
      };
    }
    const settings = await getSettings();
    const quote = this.compensationQuote(request.status, cancelledBy, settings, {
      customerId: request.customerId,
      workerId: request.providerId,
    });
    const at = new Date();

    try {
      await Cancellation.create({
        requestId: request._id,
        actorId: actorId || request.customerId,
        actorRole: cancelledBy,
        reason: reason || "Cancelled",
        eligible: quote.amountPaise > 0,
        amount: paiseToRupees(quote.amountPaise),
        amountPaise: quote.amountPaise,
        payer: quote.payer,
        receiver: quote.receiver,
        financialStatus: quote.status,
        scenario: quote.scenario,
        status: quote.amountPaise > 0 ? "approved" : "not_eligible",
        policyVersion: FINANCIAL_MODE,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      const existing = await Cancellation.findOne({ requestId: request._id }).lean();
      return {
        duplicate: true,
        finance: request.cancellationFinance || existing,
        compensationPaise: existing?.amountPaise || 0,
      };
    }

    await CancellationRecord.create({
      requestId: request._id,
      workerId: request.providerId || null,
      customerId: request.customerId || null,
      cancelledBy: cancelledBy === "business" ? "business" : cancelledBy,
      reason: reason || "",
      statusWas: request.status,
      compensation: paiseToRupees(quote.amountPaise),
      eligible: quote.amountPaise > 0,
    }).catch(() => {});

    if (quote.amountPaise > 0) {
      await insertLedger({
        requestId: request._id,
        userId: quote.receiverId,
        counterpartyId: quote.payerId,
        type: LEDGER_TYPES.COMPENSATION,
        amountPaise: quote.amountPaise,
        status: FINANCE_STATUS.SIMULATED,
        note: `${SIMULATION_LABEL}. Simulated cancellation compensation (${quote.scenario}).`,
      });
      if (quote.receiverId) {
        await User.updateOne(
          { _id: quote.receiverId },
          { $inc: { simulatedWalletPaise: quote.amountPaise, walletBalance: paiseToRupees(quote.amountPaise) } }
        );
      }
    }

    const cancellationFinance = {
      recorded: true,
      reason: reason || "Cancelled",
      cancelledBy,
      cancelledAt: at,
      amountPaise: quote.amountPaise,
      amountRupees: paiseToRupees(quote.amountPaise),
      payer: quote.payer,
      receiver: quote.receiver,
      financialStatus: quote.status,
      scenario: quote.scenario,
      financialMode: FINANCIAL_MODE,
      label: SIMULATION_LABEL,
    };

    await Request.updateOne(
      { _id: request._id },
      {
        $set: {
          cancellationFinance,
          travelCompensation: paiseToRupees(quote.amountPaise),
          "finance.status": quote.amountPaise > 0 ? FINANCE_STATUS.SIMULATED : FINANCE_STATUS.CANCELLED,
          "finance.mode": FINANCIAL_MODE,
        },
      }
    );

    return { duplicate: false, finance: cancellationFinance, compensationPaise: quote.amountPaise };
  }
}
