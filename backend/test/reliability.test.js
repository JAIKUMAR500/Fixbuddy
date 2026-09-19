import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { WorkerLock } from "../src/models/WorkerLock.js";
import { Review } from "../src/models/Review.js";
import { Session } from "../src/models/Session.js";
import { AuditLog } from "../src/models/AuditLog.js";
import requestRoutes from "../src/routes/requests.js";
import adminRoutes from "../src/routes/admin.js";
import authRoutes from "../src/routes/auth.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import { signToken } from "../src/middleware/auth.js";
import { buildLicense } from "../src/utils/license.js";
import { CANONICAL_CATEGORIES } from "../src/utils/categories.js";

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_reliability_test";
let mongoReady = false;
let seq = 0;

test.before(async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    await WorkerLock.syncIndexes();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo reliability tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `REL-${Date.now()}-${seq}`;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function makeCustomer() {
  const n = nextCode();
  return User.create({
    name: `Cust ${n}`,
    email: `c-${n}@rel.test`,
    passwordHash: "x",
    role: "customer",
    license: buildLicense({ days: 30 }),
  });
}

async function makeWorker() {
  const n = nextCode();
  return User.create({
    name: `Work ${n}`,
    email: `w-${n}@rel.test`,
    passwordHash: "x",
    role: "worker",
    license: buildLicense({ days: 30 }),
    provider: { available: true, onboarded: true, businessName: `Work ${n}` },
  });
}

async function makeAdmin() {
  const n = nextCode();
  return User.create({
    name: `Admin ${n}`,
    email: `a-${n}@rel.test`,
    passwordHash: "x",
    role: "admin",
    status: "active",
  });
}

function jobApp() {
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
  app.use("/admin", adminRoutes);
  app.use(errorHandler);
  return listen(app);
}

function sessionApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  return listen(app);
}

async function call(url, user, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-user": String(user._id),
    },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function authed(url, token, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runLifecycle(url, customer, worker, description) {
  const created = await call(url, customer, "POST", "/requests", {
    description,
    category: "Plumbing",
    estimatedAmount: 500,
  });
  assert.equal(created.status, 201);
  const id = created.data.request.id;
  assert.equal((await call(url, worker, "POST", `/requests/${id}/accept`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${id}/enroute`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${id}/arrive`)).status, 200);
  const otpDoc = await Request.findById(id).select("jobOtp").lean();
  assert.equal((await call(url, worker, "POST", `/requests/${id}/verify-otp`, { otp: otpDoc.jobOtp })).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${id}/start`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${id}/complete`)).status, 200);
  assert.equal((await call(url, worker, "POST", `/requests/${id}/collect-payment`)).status, 200);
  assert.equal((await call(url, customer, "POST", `/requests/${id}/customer-complete`)).status, 200);
  const reviewed = await call(url, customer, "POST", `/requests/${id}/review`, { rating: 5, comment: "Good work" });
  assert.equal(reviewed.status, 200);
  return id;
}

test("canonical category names stay focused", () => {
  assert.equal(CANONICAL_CATEGORIES.length, 12);
  assert.ok(CANONICAL_CATEGORIES.every((c) => c.name && c.icon));
  assert.ok(CANONICAL_CATEGORIES.some((c) => c.name === "Plumbing"));
});

test("request identity, lock release, sessions, and admin safety", async (t) => {
  if (!mongoReady) {
    t.skip("local MongoDB is not available");
    return;
  }

  const { server, url } = await jobApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  await t.test("cancel on request B cannot cancel active request A", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobB = await call(url, customer, "POST", "/requests", {
      description: "Job B displayed",
      category: "Cleaning",
      estimatedAmount: 300,
    });
    const jobA = await call(url, customer, "POST", "/requests", {
      description: "Job A active",
      category: "Plumbing",
      estimatedAmount: 400,
    });
    assert.equal(jobA.status, 201);
    assert.equal(jobB.status, 201);
    const idA = jobA.data.request.id;
    const idB = jobB.data.request.id;
    assert.notEqual(idA, idB);
    const accepted = await call(url, worker, "POST", `/requests/${idA}/accept`);
    assert.equal(accepted.status, 200);
    const cancelled = await call(url, customer, "POST", `/requests/${idB}/cancel`, { reason: "Changed plans" });
    assert.equal(cancelled.status, 200);
    const a = await Request.findById(idA).lean();
    const b = await Request.findById(idB).lean();
    assert.equal(a.status, "on_the_way");
    assert.equal(String(a.providerId), String(worker._id));
    assert.equal(b.status, "cancelled");
    assert.ok(await WorkerLock.findOne({ userId: worker._id, jobId: idA }).lean());
  });

  await t.test("impossible transitions are rejected", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "State machine",
      category: "Electrical",
      estimatedAmount: 400,
    });
    const id = created.data.request.id;
    assert.equal((await call(url, worker, "POST", `/requests/${id}/start`)).status, 403);
    assert.equal((await call(url, worker, "POST", `/requests/${id}/complete`)).status, 403);
    assert.equal((await call(url, worker, "POST", `/requests/${id}/accept`)).status, 200);
    const worker2 = await makeWorker();
    assert.equal((await call(url, worker2, "POST", `/requests/${id}/accept`)).status, 409);
    const startedEarly = await call(url, worker, "POST", `/requests/${id}/start`);
    assert.equal(startedEarly.status, 409);
  });

  await t.test("start is idempotent after work has started", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "Idempotent start",
      category: "Painting",
      estimatedAmount: 400,
    });
    const id = created.data.request.id;
    await call(url, worker, "POST", `/requests/${id}/accept`);
    await call(url, worker, "POST", `/requests/${id}/enroute`);
    await call(url, worker, "POST", `/requests/${id}/arrive`);
    const otpDoc = await Request.findById(id).select("jobOtp").lean();
    await call(url, worker, "POST", `/requests/${id}/verify-otp`, { otp: otpDoc.jobOtp });
    assert.equal((await call(url, worker, "POST", `/requests/${id}/start`)).status, 200);
    const again = await call(url, worker, "POST", `/requests/${id}/start`);
    assert.equal(again.status, 200);
    assert.equal(again.data.duplicate, true);
    const job = await Request.findById(id).lean();
    assert.equal(job.status, "in_progress");
  });

  await t.test("enroute, arrive, and OTP retries do not change state or regenerate OTP", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "Idempotent travel",
      category: "Plumbing",
      estimatedAmount: 400,
    });
    const id = created.data.request.id;
    await call(url, worker, "POST", `/requests/${id}/accept`);
    assert.equal((await call(url, worker, "POST", `/requests/${id}/enroute`)).status, 200);
    const againEnroute = await call(url, worker, "POST", `/requests/${id}/enroute`);
    assert.equal(againEnroute.status, 200);
    assert.equal(againEnroute.data.duplicate, true);
    assert.equal((await call(url, worker, "POST", `/requests/${id}/arrive`)).status, 200);
    const otp1 = (await Request.findById(id).select("jobOtp status").lean()).jobOtp;
    assert.equal(otp1.length, 4);
    const againArrive = await call(url, worker, "POST", `/requests/${id}/arrive`);
    assert.equal(againArrive.status, 200);
    assert.equal(againArrive.data.duplicate, true);
    const otp2 = (await Request.findById(id).select("jobOtp").lean()).jobOtp;
    assert.equal(otp2, otp1);
    assert.equal((await call(url, worker, "POST", `/requests/${id}/verify-otp`, { otp: otp1 })).status, 200);
    const againOtp = await call(url, worker, "POST", `/requests/${id}/verify-otp`, { otp: otp1 });
    assert.equal(againOtp.status, 200);
    assert.equal(againOtp.data.duplicate, true);
  });

  await t.test("full lifecycle then worker can accept Job B", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await runLifecycle(url, customer, worker, "Lifecycle job A");
    assert.equal(await WorkerLock.findOne({ userId: worker._id }).lean(), null);
    const review = await Review.findOne({ requestId: jobA }).lean();
    assert.ok(review);
    assert.equal(review.rating, 5);
    const jobB = await call(url, customer, "POST", "/requests", {
      description: "Lifecycle job B",
      category: "Carpentry",
      estimatedAmount: 450,
    });
    const accepted = await call(url, worker, "POST", `/requests/${jobB.data.request.id}/accept`);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.request.status, "on_the_way");
  });

  await t.test("invalid request and admin IDs are 400, missing resources 404", async () => {
    const worker = await makeWorker();
    const admin = await makeAdmin();
    assert.equal((await call(url, worker, "GET", "/requests/not-an-id")).status, 400);
    const missing = await call(url, worker, "GET", `/requests/${new mongoose.Types.ObjectId()}`);
    assert.equal(missing.status, 404);
    assert.equal((await call(url, admin, "GET", "/admin/users/not-an-id")).status, 400);
    const missingUser = await call(url, admin, "GET", `/admin/users/${new mongoose.Types.ObjectId()}`);
    assert.equal(missingUser.status, 404);
  });

  await t.test("admin suspend requires a reason and writes an audit log", async () => {
    const admin = await makeAdmin();
    const worker = await makeWorker();
    const denied = await call(url, admin, "PATCH", `/admin/users/${worker._id}`, { status: "suspended" });
    assert.equal(denied.status, 400);
    const ok = await call(url, admin, "PATCH", `/admin/users/${worker._id}`, {
      status: "suspended",
      reason: "Repeated no-shows",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.status, "suspended");
    const log = await AuditLog.findOne({ action: /suspended/i }).lean();
    assert.ok(log);
    assert.equal(log.meta.reason, "Repeated no-shows");
  });
});

test("logout revokes the current session token", async (t) => {
  if (!mongoReady) {
    t.skip("local MongoDB is not available");
    return;
  }
  const { server, url } = await sessionApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const user = await makeCustomer();
  const token = await signToken(user);
  const before = await authed(url, token, "GET", "/api/auth/me");
  assert.equal(before.status, 200);
  const logout = await authed(url, token, "POST", "/api/auth/logout");
  assert.equal(logout.status, 204);
  const after = await authed(url, token, "GET", "/api/auth/me");
  assert.equal(after.status, 401);
  const session = await Session.findOne({ userId: user._id }).lean();
  assert.ok(session.revokedAt);
  const bogus = await authed(url, "not-a-jwt", "GET", "/api/auth/me");
  assert.equal(bogus.status, 401);
  const fresh = await signToken(user);
  const again = await authed(url, fresh, "GET", "/api/auth/me");
  assert.equal(again.status, 200);
});
