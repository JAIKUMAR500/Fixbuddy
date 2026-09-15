import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { WorkerLock } from "../src/models/WorkerLock.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
import { PlatformSettings } from "../src/models/PlatformSettings.js";
import requestRoutes from "../src/routes/requests.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import {
  LEDGER_TYPES,
  commissionPaise,
  netPaise,
  paiseToRupees,
  rupeesToPaise,
} from "../src/services/payments/index.js";
import { DevelopmentPaymentService } from "../src/services/payments/DevelopmentPaymentService.js";
import { FutureProductionPaymentService } from "../src/services/payments/FutureProductionPaymentService.js";

test("integer paise conversion never uses float rupees for commission", () => {
  assert.equal(rupeesToPaise(1000), 100000);
  assert.equal(paiseToRupees(100000), 1000);
  assert.equal(rupeesToPaise(-50), 0);
  assert.equal(commissionPaise(100000, 10), 10000);
  assert.equal(netPaise(100000, 10000), 90000);
  assert.equal(commissionPaise(100000, 0), 0);
  assert.equal(netPaise(100, 1000), 0);
});

test("negative and invalid money inputs clamp to zero", () => {
  assert.equal(rupeesToPaise("nope"), 0);
  assert.equal(commissionPaise(-1, 10), 0);
  assert.equal(paiseToRupees(-99), 0);
});

test("production payment provider is not active", async () => {
  const prod = new FutureProductionPaymentService();
  await assert.rejects(() => prod.settleJob(), (err) => err.status === 501);
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_finance_test";
let mongoReady = false;
let seq = 0;

test.before(async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    await LedgerEntry.syncIndexes();
    await PlatformSettings.create({ key: "default", commissionPercent: 10, travelCompensationInr: 75 });
    mongoReady = true;
  } catch (err) {
    console.warn("Skipping Mongo finance tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `FIN-${Date.now()}-${seq}`;
}

async function makeCustomer() {
  const n = nextCode();
  return User.create({ name: `Cust ${n}`, email: `c-${n}@fin.test`, passwordHash: "x", role: "customer" });
}

async function makeWorker() {
  const n = nextCode();
  return User.create({
    name: `Work ${n}`,
    email: `w-${n}@fin.test`,
    passwordHash: "x",
    role: "worker",
    provider: { available: true, businessName: `Work ${n}` },
  });
}

function appServer() {
  const app = express();
  app.use(express.json());
  app.use(async (req, _res, next) => {
    const id = req.headers["x-test-user"];
    if (!id) return next(httpError(401, "Sign in required"));
    const user = await User.findById(id).lean();
    if (!user) return next(httpError(401, "Account not found"));
    req.user = user;
    req.userId = String(user._id);
    next();
  });
  app.use("/requests", requestRoutes);
  app.use(errorHandler);
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function call(url, user, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-user": String(user._id) },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function finishToComplete(url, worker, jobId) {
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/accept`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/enroute`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/arrive`)).status, 200);
  const otpDoc = await Request.findById(jobId).select("jobOtp").lean();
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/verify-otp`, { otp: otpDoc.jobOtp })).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/start`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${jobId}/complete`)).status, 200);
}

test("Phase 3 development financial simulation", async (t) => {
  if (!mongoReady) {
    t.skip("local MongoDB is not available");
    return;
  }
  const { server, url } = await appServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  await t.test("TEST 1-5: ₹1000 job settles once with commission and worker net", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "AC service for simulation",
      category: "AC Repair & Service",
      estimatedAmount: 1000,
    });
    assert.equal(created.status, 201);
    const jobId = created.data.request.id;
    assert.equal(created.data.request.finance.jobPricePaise, 100000);
    await finishToComplete(url, worker, jobId);

    const first = await call(url, worker, "POST", `/requests/${jobId}/collect-payment`);
    assert.equal(first.status, 200);
    assert.equal(first.data.finance.jobPricePaise, 100000);
    assert.equal(first.data.finance.commissionPercent, 10);
    assert.equal(first.data.finance.commissionPaise, 10000);
    assert.equal(first.data.finance.workerGrossPaise, 100000);
    assert.equal(first.data.finance.workerNetPaise, 90000);
    assert.equal(first.data.request.finance.settled, true);

    const types = await LedgerEntry.find({ requestId: jobId }).lean();
    assert.equal(types.filter((x) => x.type === LEDGER_TYPES.JOB_PAYMENT).length, 1);
    assert.equal(types.filter((x) => x.type === LEDGER_TYPES.COMMISSION).length, 1);
    assert.equal(types.filter((x) => x.type === LEDGER_TYPES.WORKER_EARNING).length, 1);

    const againComplete = await call(url, worker, "POST", `/requests/${jobId}/complete`);
    assert.equal(againComplete.status, 200);
    const againPay = await call(url, worker, "POST", `/requests/${jobId}/collect-payment`);
    assert.equal(againPay.status, 200);
    assert.equal(againPay.data.duplicate, true);
    assert.equal(await LedgerEntry.countDocuments({ requestId: jobId, type: LEDGER_TYPES.COMMISSION }), 1);
    assert.equal(await LedgerEntry.countDocuments({ requestId: jobId, type: LEDGER_TYPES.WORKER_EARNING }), 1);

    const lock = await WorkerLock.findOne({ userId: worker._id }).lean();
    assert.equal(lock, null);
    const wallet = await User.findById(worker._id).lean();
    assert.equal(wallet.simulatedWalletPaise, 90000);
  });

  await t.test("TEST 6-9: customer/worker cancel compensation is simulated once", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "Cancel before accept",
      category: "AC Repair & Service",
      estimatedAmount: 1000,
    });
    const before = await call(url, customer, "POST", `/requests/${created.data.request.id}/cancel`, { reason: "Changed plans" });
    assert.equal(before.status, 200);
    assert.equal(before.data.finance.amountPaise, 0);
    assert.equal(before.data.finance.financialStatus, "not_applicable");
    const again = await call(url, customer, "POST", `/requests/${created.data.request.id}/cancel`, { reason: "Changed plans" });
    assert.equal(again.status, 200);
    assert.equal(again.data.duplicate, true);

    const job2 = await call(url, customer, "POST", "/requests", {
      description: "Cancel after arrive",
      category: "AC Repair & Service",
      estimatedAmount: 1000,
    });
    const id2 = job2.data.request.id;
    await call(url, worker, "POST", `/requests/${id2}/accept`);
    await call(url, worker, "POST", `/requests/${id2}/enroute`);
    await call(url, worker, "POST", `/requests/${id2}/arrive`);
    const afterArrive = await call(url, customer, "POST", `/requests/${id2}/cancel`, { reason: "Worker delayed" });
    assert.equal(afterArrive.status, 200);
    assert.equal(afterArrive.data.finance.scenario, "customer_after_arrive");
    assert.equal(afterArrive.data.finance.amountPaise, 7500);
    assert.equal(afterArrive.data.finance.payer, "customer");
    assert.equal(afterArrive.data.finance.receiver, "worker");
    assert.equal(await LedgerEntry.countDocuments({ requestId: id2, type: LEDGER_TYPES.COMPENSATION }), 1);
    const repeatComp = await call(url, customer, "POST", `/requests/${id2}/cancel`, { reason: "again" });
    assert.equal(repeatComp.data.duplicate, true);
    assert.equal(await LedgerEntry.countDocuments({ requestId: id2, type: LEDGER_TYPES.COMPENSATION }), 1);

    const job3 = await call(url, customer, "POST", "/requests", {
      description: "Worker cancel after accept",
      category: "AC Repair & Service",
      estimatedAmount: 500,
    });
    const id3 = job3.data.request.id;
    await call(url, worker, "POST", `/requests/${id3}/accept`);
    const workerCancel = await call(url, worker, "POST", `/requests/${id3}/cancel`, { reason: "Emergency" });
    assert.equal(workerCancel.status, 200);
    assert.equal(workerCancel.data.finance.scenario, "worker_after_accept");
    assert.equal(workerCancel.data.finance.amountPaise, 0);
    assert.equal(await WorkerLock.findOne({ userId: worker._id }).lean(), null);
  });

  await t.test("TEST 12-13: completion flow and lock release still work", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "Lock release after simulated pay",
      category: "AC Repair & Service",
      estimatedAmount: 400,
    });
    const jobId = created.data.request.id;
    await finishToComplete(url, worker, jobId);
    const current = await call(url, worker, "GET", "/requests/current-job");
    assert.equal(current.data.locked, true);
    await call(url, worker, "POST", `/requests/${jobId}/collect-payment`);
    const after = await call(url, worker, "GET", "/requests/current-job");
    assert.equal(after.data.locked, false);
    assert.equal(after.data.request, null);
  });

  await t.test("DevelopmentPaymentService quote matches ₹1000 example", async () => {
    const svc = new DevelopmentPaymentService();
    const calc = svc.quote({ estimatedAmount: 1000, workerQuote: null, finance: {} }, { commissionPercent: 10 });
    assert.equal(calc.jobPricePaise, 100000);
    assert.equal(calc.commissionPaise, 10000);
    assert.equal(calc.workerNetPaise, 90000);
  });
});
