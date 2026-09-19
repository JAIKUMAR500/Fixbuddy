import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
import { PaymentOrder } from "../src/models/PaymentOrder.js";
import { WebhookEvent } from "../src/models/WebhookEvent.js";
import { PlatformSettings } from "../src/models/PlatformSettings.js";
import { clearSettingsCache } from "../src/models/PlatformSettings.js";
import {
  GATEWAYS,
  gatewayConfig,
  gatewayProblems,
  isGatewayReady,
  paymentEnvProblems,
  publicGatewayInfo,
  resolvedFinancialMode,
} from "../src/services/payments/gatewayConfig.js";
import {
  razorpaySignature,
  stripeSignature,
  verifyRazorpayCheckout,
  verifyWebhookSignature,
  safeEqual,
} from "../src/services/payments/signature.js";
import { ProductionPaymentService, authoritativeAmountPaise } from "../src/services/payments/ProductionPaymentService.js";
import { getPaymentService, DevelopmentPaymentService } from "../src/services/payments/index.js";
import { FINANCE_STATUS, LIVE_LEDGER_TYPES } from "../src/services/payments/config.js";
import { rupeesToPaise } from "../src/services/payments/money.js";

const RAZORPAY_ENV = {
  FINANCIAL_MODE: "production",
  PAYMENT_GATEWAY: "razorpay",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp_test_secret",
  RAZORPAY_WEBHOOK_SECRET: "whsec_razorpay",
};

const STRIPE_ENV = {
  FINANCIAL_MODE: "production",
  PAYMENT_GATEWAY: "stripe",
  STRIPE_PUBLISHABLE_KEY: "pk_test",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe",
};

test("live payments stay disabled unless the gateway is fully configured", () => {
  assert.equal(isGatewayReady({}), false);
  assert.equal(resolvedFinancialMode({}), "development");

  // Production requested but nothing configured.
  assert.equal(isGatewayReady({ FINANCIAL_MODE: "production" }), false);

  // Configured gateway but mode left at development.
  assert.equal(isGatewayReady({ ...RAZORPAY_ENV, FINANCIAL_MODE: "development" }), false);

  // Half-configured production is refused.
  assert.equal(isGatewayReady({ ...RAZORPAY_ENV, RAZORPAY_WEBHOOK_SECRET: "" }), false);

  assert.equal(isGatewayReady(RAZORPAY_ENV), true);
  assert.equal(isGatewayReady(STRIPE_ENV), true);
});

test("this process runs the simulated service, so no real money can move", () => {
  assert.equal(isGatewayReady(), false);
  assert.equal(getPaymentService() instanceof DevelopmentPaymentService, true);
});

test("startup refuses a half-configured or contradictory payment setup", () => {
  assert.deepEqual(paymentEnvProblems({}), []);

  const missing = paymentEnvProblems({ FINANCIAL_MODE: "production", PAYMENT_GATEWAY: "razorpay" });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /RAZORPAY_KEY_SECRET/);
  assert.match(missing[0], /RAZORPAY_WEBHOOK_SECRET/);

  const stray = paymentEnvProblems({ PAYMENT_GATEWAY: "stripe", STRIPE_SECRET_KEY: "sk_test" });
  assert.equal(stray.length, 1);
  assert.match(stray[0], /FINANCIAL_MODE is development/);

  assert.deepEqual(paymentEnvProblems(RAZORPAY_ENV), []);
  assert.deepEqual(gatewayProblems(RAZORPAY_ENV), []);
});

test("only non-secret gateway values are exposed to the client", () => {
  const info = publicGatewayInfo(RAZORPAY_ENV);
  assert.equal(info.enabled, true);
  assert.equal(info.provider, "razorpay");
  assert.equal(info.keyId, "rzp_test_key");
  const serialized = JSON.stringify(info);
  assert.equal(serialized.includes("rzp_test_secret"), false);
  assert.equal(serialized.includes("whsec_razorpay"), false);
  assert.equal("keySecret" in info, false);
  assert.equal("webhookSecret" in info, false);

  const off = publicGatewayInfo({});
  assert.equal(off.enabled, false);
  assert.equal(off.keyId, "");
});

test("amounts are integer paise taken from the job, never from the client", () => {
  assert.equal(authoritativeAmountPaise({ workerQuote: 1000 }), 100000);
  assert.equal(authoritativeAmountPaise({ estimatedAmount: 450 }), 45000);
  // A client-supplied amount field is not consulted.
  assert.equal(authoritativeAmountPaise({ estimatedAmount: 450, amount: 1 }), 45000);
  assert.equal(authoritativeAmountPaise({ finance: { jobPricePaise: 12300 } }), 12300);
  assert.equal(authoritativeAmountPaise({}), 0);
  assert.equal(Number.isInteger(authoritativeAmountPaise({ workerQuote: 1000 })), true);
});

test("razorpay webhook signatures are verified against the raw body", () => {
  const body = JSON.stringify({ event: "payment.captured", id: "evt_1" });
  const good = razorpaySignature(body, RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET);

  assert.equal(
    verifyWebhookSignature({
      provider: GATEWAYS.RAZORPAY,
      rawBody: body,
      headers: { "x-razorpay-signature": good },
      secret: RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET,
    }).ok,
    true
  );

  const wrongSecret = verifyWebhookSignature({
    provider: GATEWAYS.RAZORPAY,
    rawBody: body,
    headers: { "x-razorpay-signature": razorpaySignature(body, "attacker") },
    secret: RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET,
  });
  assert.equal(wrongSecret.ok, false);
  assert.match(wrongSecret.reason, /mismatch/i);

  // Any tampering with the body invalidates the signature.
  const tampered = verifyWebhookSignature({
    provider: GATEWAYS.RAZORPAY,
    rawBody: `${body} `,
    headers: { "x-razorpay-signature": good },
    secret: RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET,
  });
  assert.equal(tampered.ok, false);

  assert.equal(
    verifyWebhookSignature({
      provider: GATEWAYS.RAZORPAY,
      rawBody: body,
      headers: {},
      secret: RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET,
    }).ok,
    false
  );
});

test("stripe webhook signatures verify the timestamp window too", () => {
  const body = JSON.stringify({ id: "evt_2", type: "payment_intent.succeeded" });
  const now = 1_700_000_000;
  const sig = stripeSignature(body, STRIPE_ENV.STRIPE_WEBHOOK_SECRET, now);

  assert.equal(
    verifyWebhookSignature({
      provider: GATEWAYS.STRIPE,
      rawBody: body,
      headers: { "stripe-signature": `t=${now},v1=${sig}` },
      secret: STRIPE_ENV.STRIPE_WEBHOOK_SECRET,
      nowSec: now,
    }).ok,
    true
  );

  const stale = verifyWebhookSignature({
    provider: GATEWAYS.STRIPE,
    rawBody: body,
    headers: { "stripe-signature": `t=${now},v1=${sig}` },
    secret: STRIPE_ENV.STRIPE_WEBHOOK_SECRET,
    nowSec: now + 4000,
  });
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /timestamp/i);
});

test("constant-time compare rejects different lengths and empty values", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test("razorpay checkout handshake is verified with order and payment ids", () => {
  const secret = RAZORPAY_ENV.RAZORPAY_KEY_SECRET;
  const signature = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.equal(verifyRazorpayCheckout({ orderId: "order_1", paymentId: "pay_1", signature, secret }), true);
  assert.equal(verifyRazorpayCheckout({ orderId: "order_1", paymentId: "pay_2", signature, secret }), false);
  assert.equal(verifyRazorpayCheckout({ orderId: "order_1", paymentId: "pay_1", signature, secret: "x" }), false);
});

test("webhook payloads are parsed for both gateways", () => {
  const razorpay = new ProductionPaymentService({
    config: gatewayConfig(RAZORPAY_ENV),
    client: { createOrder: async () => ({}) },
  });
  const parsedRzp = razorpay.parseWebhook({
    id: "evt_10",
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_9", order_id: "order_9", amount: 100000, status: "captured" } } },
  });
  assert.deepEqual(parsedRzp, {
    eventId: "evt_10",
    eventType: "payment.captured",
    orderId: "order_9",
    paymentId: "pay_9",
    amountPaise: 100000,
    captured: true,
    failed: false,
  });

  const stripe = new ProductionPaymentService({
    config: gatewayConfig(STRIPE_ENV),
    client: { createOrder: async () => ({}) },
  });
  const parsedStripe = stripe.parseWebhook({
    id: "evt_11",
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_1", amount: 45000 } },
  });
  assert.equal(parsedStripe.failed, true);
  assert.equal(parsedStripe.captured, false);
  assert.equal(parsedStripe.orderId, "pi_1");
});

/* ── Database-backed order and webhook behaviour ────────────────────────────── */

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_pay_test";
let mongoReady = false;
let seq = 0;

function nextCode() {
  seq += 1;
  return `PAY-${Date.now()}-${seq}`;
}

test.before(async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    await PaymentOrder.syncIndexes();
    await WebhookEvent.syncIndexes();
    await LedgerEntry.syncIndexes();
    await PlatformSettings.create({ key: "default" });
    clearSettingsCache();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo payment tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

async function seedJob({ status = "completed", amount = 1000 } = {}) {
  const customer = await User.create({
    name: "Pay Customer",
    email: `pc-${nextCode()}@pay.test`,
    passwordHash: "x",
    role: "customer",
  });
  const worker = await User.create({
    name: "Pay Worker",
    email: `pw-${nextCode()}@pay.test`,
    passwordHash: "x",
    role: "worker",
    provider: { businessName: "Pay Worker", available: true },
  });
  const job = await Request.create({
    code: nextCode(),
    customerId: customer._id,
    providerId: worker._id,
    description: "Live payment job",
    category: "AC Repair & Service",
    status,
    estimatedAmount: amount,
  });
  return { customer, worker, job };
}

function serviceWithOrder(orderId, amountPaise) {
  const calls = [];
  const service = new ProductionPaymentService({
    config: gatewayConfig(RAZORPAY_ENV),
    client: {
      createOrder: async (args) => {
        calls.push(args);
        return { orderId, amountPaise, currency: "INR" };
      },
    },
  });
  return { service, calls };
}

function razorpayWebhook(
  service,
  { eventId, orderId, paymentId, amountPaise, event = "payment.captured", entityStatus }
) {
  const status = entityStatus || (event === "payment.captured" ? "captured" : "authorized");
  const body = JSON.stringify({
    id: eventId,
    event,
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: amountPaise, status } } },
  });
  const signature = razorpaySignature(body, RAZORPAY_ENV.RAZORPAY_WEBHOOK_SECRET);
  return service.handleWebhook({
    rawBody: Buffer.from(body),
    headers: { "x-razorpay-signature": signature },
  });
}

test("order creation uses the server-side amount and is reused on retry", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, job } = await seedJob({ amount: 1000 });
  const { service, calls } = serviceWithOrder("order_reuse", rupeesToPaise(1000));

  const first = await service.createOrder({ request: job, customerId: String(customer._id) });
  assert.equal(first.amountPaise, 100000);
  assert.equal(first.currency, "INR");
  assert.equal(first.reused, false);
  assert.equal(calls[0].amountPaise, 100000);

  const fresh = await Request.findById(job._id);
  assert.equal(fresh.finance.status, FINANCE_STATUS.AWAITING_PAYMENT);
  assert.equal(fresh.finance.jobPricePaise, 100000);

  const second = await service.createOrder({ request: fresh, customerId: String(customer._id) });
  assert.equal(second.reused, true);
  assert.equal(second.orderId, "order_reuse");
  // No second gateway order was opened.
  assert.equal(calls.length, 1);
});

test("order creation rejects other users, unpayable states, and zero amounts", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { worker, job } = await seedJob({ amount: 500 });
  const { service } = serviceWithOrder("order_guard", rupeesToPaise(500));

  await assert.rejects(
    () => service.createOrder({ request: job, customerId: String(worker._id) }),
    /do not have access/i
  );

  const { customer: c2, job: pending } = await seedJob({ status: "matching", amount: 500 });
  await assert.rejects(
    () => service.createOrder({ request: pending, customerId: String(c2._id) }),
    /not ready for payment/i
  );

  const { customer: c3, job: free } = await seedJob({ amount: 0 });
  await assert.rejects(
    () => service.createOrder({ request: free, customerId: String(c3._id) }),
    /no payable amount/i
  );
});

test("a gateway amount that disagrees with the order is refused", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, job } = await seedJob({ amount: 800 });
  const { service } = serviceWithOrder("order_mismatch", 1);
  await assert.rejects(
    () => service.createOrder({ request: job, customerId: String(customer._id) }),
    /different amount/i
  );
});

test("a captured webhook writes the job payment, platform fee, and worker credit once", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, worker, job } = await seedJob({ amount: 1000 });
  const { service } = serviceWithOrder("order_capture", rupeesToPaise(1000));
  await service.createOrder({ request: job, customerId: String(customer._id) });

  const result = await razorpayWebhook(service, {
    eventId: "evt_capture_1",
    orderId: "order_capture",
    paymentId: "pay_capture_1",
    amountPaise: 100000,
  });

  assert.equal(result.status, "captured");
  assert.equal(result.jobPricePaise, 100000);
  assert.equal(result.commissionPaise, 10000);
  assert.equal(result.workerNetPaise, 90000);

  const entries = await LedgerEntry.find({ requestId: job._id }).lean();
  const byType = Object.fromEntries(entries.map((e) => [e.type, e]));
  assert.equal(entries.length, 3);
  assert.equal(byType[LIVE_LEDGER_TYPES.JOB_PAYMENT].amountPaise, 100000);
  assert.equal(byType[LIVE_LEDGER_TYPES.COMMISSION].amountPaise, 10000);
  assert.equal(byType[LIVE_LEDGER_TYPES.WORKER_EARNING].amountPaise, 90000);
  assert.equal(byType[LIVE_LEDGER_TYPES.JOB_PAYMENT].financialMode, "production");

  const paid = await Request.findById(job._id);
  assert.equal(paid.paymentStatus, "collected");
  assert.equal(paid.finance.settled, true);
  assert.equal(paid.finance.status, FINANCE_STATUS.CAPTURED);
  assert.equal(paid.finance.settlementRef, "pay_capture_1");

  const order = await PaymentOrder.findOne({ orderId: "order_capture" }).lean();
  assert.equal(order.status, "paid");
  assert.equal(order.gatewayPaymentId, "pay_capture_1");

  const credited = await User.findById(worker._id).lean();
  assert.equal(credited.simulatedWalletPaise, 90000);
});

test("a replayed webhook is a no-op and never double-credits", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, worker, job } = await seedJob({ amount: 2000 });
  const { service } = serviceWithOrder("order_dup", rupeesToPaise(2000));
  await service.createOrder({ request: job, customerId: String(customer._id) });

  const payload = {
    eventId: "evt_dup_1",
    orderId: "order_dup",
    paymentId: "pay_dup_1",
    amountPaise: 200000,
  };

  const first = await razorpayWebhook(service, payload);
  assert.equal(first.status, "captured");

  const replay = await razorpayWebhook(service, payload);
  assert.equal(replay.status, "duplicate");

  const thirdTime = await razorpayWebhook(service, payload);
  assert.equal(thirdTime.status, "duplicate");

  const entries = await LedgerEntry.find({ requestId: job._id }).lean();
  assert.equal(entries.length, 3, "replays must not add ledger rows");

  const credited = await User.findById(worker._id).lean();
  assert.equal(credited.simulatedWalletPaise, 180000, "worker must be credited exactly once");

  const events = await WebhookEvent.countDocuments({ eventId: "evt_dup_1" });
  assert.equal(events, 1);
});

test("an invalid signature never reaches the ledger", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, job } = await seedJob({ amount: 700 });
  const { service } = serviceWithOrder("order_badsig", rupeesToPaise(700));
  await service.createOrder({ request: job, customerId: String(customer._id) });

  const body = JSON.stringify({
    id: "evt_badsig",
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_x", order_id: "order_badsig", amount: 70000 } } },
  });

  await assert.rejects(
    () =>
      service.handleWebhook({
        rawBody: Buffer.from(body),
        headers: { "x-razorpay-signature": razorpaySignature(body, "wrong-secret") },
      }),
    /Invalid webhook signature/i
  );

  assert.equal(await LedgerEntry.countDocuments({ requestId: job._id }), 0);
  assert.equal(await WebhookEvent.countDocuments({ eventId: "evt_badsig" }), 0);
  const untouched = await Request.findById(job._id);
  assert.notEqual(untouched.paymentStatus, "collected");
});

test("a webhook amount that does not match the recorded order is refused", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, job } = await seedJob({ amount: 900 });
  const { service } = serviceWithOrder("order_amount", rupeesToPaise(900));
  await service.createOrder({ request: job, customerId: String(customer._id) });

  await assert.rejects(
    () =>
      razorpayWebhook(service, {
        eventId: "evt_amount_1",
        orderId: "order_amount",
        paymentId: "pay_amount_1",
        amountPaise: 1,
      }),
    /does not match the recorded order amount/i
  );

  assert.equal(await LedgerEntry.countDocuments({ requestId: job._id }), 0);
  const untouched = await Request.findById(job._id);
  assert.notEqual(untouched.paymentStatus, "collected");
});

test("a failed payment marks the order without crediting anyone", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { customer, worker, job } = await seedJob({ amount: 600 });
  const { service } = serviceWithOrder("order_failed", rupeesToPaise(600));
  await service.createOrder({ request: job, customerId: String(customer._id) });

  const result = await razorpayWebhook(service, {
    eventId: "evt_failed_1",
    orderId: "order_failed",
    paymentId: "pay_failed_1",
    amountPaise: 60000,
    event: "payment.failed",
  });

  assert.equal(result.status, "failed");
  assert.equal(await LedgerEntry.countDocuments({ requestId: job._id }), 0);
  const order = await PaymentOrder.findOne({ orderId: "order_failed" }).lean();
  assert.equal(order.status, "failed");
  const notCredited = await User.findById(worker._id).lean();
  assert.equal(notCredited.simulatedWalletPaise || 0, 0);
  const untouched = await Request.findById(job._id);
  assert.equal(untouched.finance.status, FINANCE_STATUS.FAILED);
});

test("unrelated webhook events are ignored and unknown orders are rejected", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { service } = serviceWithOrder("order_none", 100);

  // An authorized-but-not-captured event carries no money and is ignored.
  const ignored = await razorpayWebhook(service, {
    eventId: "evt_other",
    orderId: "order_none",
    paymentId: "pay_other",
    amountPaise: 100,
    event: "payment.authorized",
    entityStatus: "authorized",
  });
  assert.equal(ignored.status, "ignored");

  await assert.rejects(
    () =>
      razorpayWebhook(service, {
        eventId: "evt_unknown_order",
        orderId: "order_does_not_exist",
        paymentId: "pay_1",
        amountPaise: 100,
      }),
    /Unknown payment order/i
  );
});

test("live settlement cannot be triggered by an API call", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const { job } = await seedJob({ amount: 400 });
  const { service } = serviceWithOrder("order_nosettle", rupeesToPaise(400));
  await assert.rejects(() => service.settleJob(job), /settle from the gateway webhook/i);
});
