import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { WorkerLock } from "../src/models/WorkerLock.js";
import requestRoutes from "../src/routes/requests.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import { buildLicense } from "../src/utils/license.js";

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_tracking_test";
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
    console.warn("Skipping Mongo tracking tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `TRK-${Date.now()}-${seq}`;
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
  app.use(errorHandler);
  return listen(app);
}

async function makeCustomer() {
  const n = nextCode();
  return User.create({
    name: `Cust ${n}`,
    email: `c-${n}@trk.test`,
    passwordHash: "x",
    role: "customer",
    license: buildLicense({ days: 30 }),
  });
}

async function makeWorker() {
  const n = nextCode();
  return User.create({
    name: `Work ${n}`,
    email: `w-${n}@trk.test`,
    passwordHash: "x",
    role: "worker",
    license: buildLicense({ days: 30 }),
    provider: {
      available: true,
      onboarded: true,
      businessName: `Work ${n}`,
      ratingAvg: 4.8,
      category: "Plumbing",
      skills: [{ name: "Plumbing" }, { name: "AC Repair & Service" }, { name: "Electrical" }],
    },
  });
}

async function call(url, user, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-user": String(user._id) },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function createJob(url, customer) {
  const created = await call(url, customer, "POST", "/requests", {
    description: "Kitchen tap leak",
    category: "Plumbing",
    estimatedAmount: 500,
    address: "12 Test Street",
    area: "Peelamedu",
    city: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    publicPost: true,
    timing: "asap",
  });
  assert.equal(created.status, 201, created.data.message);
  return created.data.request;
}

test("accept, live tracking, OTP, complete, and authorization", async (t) => {
  if (!mongoReady) return;
  const { server, url } = await jobApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const customer = await makeCustomer();
  const worker = await makeWorker();
  const stranger = await makeWorker();
  const job = await createJob(url, customer);

  await t.test("worker accept assigns the job and moves it EN_ROUTE", async () => {
    const accepted = await call(url, worker, "POST", `/requests/${job.id}/accept`, { lat: 11.02, lng: 76.96 });
    assert.equal(accepted.status, 200, accepted.data.message);
    assert.equal(accepted.data.request.providerId, String(worker._id));
    assert.equal(accepted.data.request.status, "on_the_way");
    assert.equal(accepted.data.request.trackingActive, true);
    assert.equal(accepted.data.request.workerLat, 11.02);
    assert.equal(accepted.data.request.jobOtp, undefined);
  });

  await t.test("customer tracking payload includes live location and ETA", async () => {
    const tracking = await call(url, customer, "GET", `/requests/${job.id}/tracking`);
    assert.equal(tracking.status, 200);
    assert.equal(tracking.data.tracking, true);
    assert.equal(tracking.data.latitude, 11.02);
    assert.equal(tracking.data.longitude, 76.96);
    assert.equal(typeof tracking.data.distanceKm, "number");
    assert.ok(tracking.data.etaMinutes >= 1);
  });

  await t.test("unauthorized users cannot read or publish location", async () => {
    const peek = await call(url, stranger, "GET", `/requests/${job.id}/tracking`);
    assert.equal(peek.status, 403);
    const spoof = await call(url, stranger, "PATCH", `/requests/${job.id}/location`, { lat: 12, lng: 77 });
    assert.equal(spoof.status, 403);
    const customerPing = await call(url, customer, "PATCH", `/requests/${job.id}/location`, { lat: 12, lng: 77 });
    assert.equal(customerPing.status, 403);
  });

  await t.test("assigned worker can publish a location update", async () => {
    const ping = await call(url, worker, "PATCH", `/requests/${job.id}/location`, { lat: 11.018, lng: 76.957 });
    assert.equal(ping.status, 200);
    assert.equal(ping.data.request.workerLat, 11.018);
    const view = await call(url, customer, "GET", `/requests/${job.id}`);
    assert.equal(view.data.request.workerLat, 11.018);
    assert.equal(view.data.request.jobOtp, undefined);
  });

  await t.test("invalid transitions are rejected", async () => {
    assert.equal((await call(url, worker, "POST", `/requests/${job.id}/complete`)).status, 409);
    assert.equal((await call(url, worker, "POST", `/requests/${job.id}/start`)).status, 409);
  });

  await t.test("arrived generates OTP for the customer only", async () => {
    const arrive = await call(url, worker, "POST", `/requests/${job.id}/arrive`, { lat: 11.0168, lng: 76.9558 });
    assert.equal(arrive.status, 200);
    assert.equal(arrive.data.request.status, "arrived");
    assert.equal(arrive.data.request.jobOtp, undefined);
    const customerView = await call(url, customer, "GET", `/requests/${job.id}`);
    assert.match(customerView.data.request.jobOtp, /^\d{4}$/);
    const stored = await Request.findById(job.id).lean();
    assert.ok(stored.arrivedAt);
    assert.equal(stored.jobOtp, customerView.data.request.jobOtp);
  });

  await t.test("invalid and expired OTP do not start work", async () => {
    const bad = await call(url, worker, "POST", `/requests/${job.id}/verify-otp`, { otp: "0000" });
    assert.equal(bad.status, 400);
    assert.match(bad.data.message, /Incorrect OTP/i);
    let stored = await Request.findById(job.id).lean();
    assert.equal(stored.status, "arrived");
    const real = stored.jobOtp;
    await Request.updateOne({ _id: job.id }, { $set: { jobOtpExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await call(url, worker, "POST", `/requests/${job.id}/verify-otp`, { otp: real });
    assert.equal(expired.status, 400);
    assert.match(expired.data.message, /expired/i);
    stored = await Request.findById(job.id).lean();
    assert.equal(stored.status, "arrived");
    await Request.updateOne(
      { _id: job.id },
      { $set: { jobOtp: real, jobOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000) } }
    );
  });

  await t.test("valid OTP starts work", async () => {
    const stored = await Request.findById(job.id).select("jobOtp").lean();
    const ok = await call(url, worker, "POST", `/requests/${job.id}/verify-otp`, { otp: stored.jobOtp });
    assert.equal(ok.status, 200, ok.data.message);
    assert.equal(ok.data.request.status, "in_progress");
    assert.equal(ok.data.request.otpVerified, true);
    assert.equal(ok.data.request.jobOtp, undefined);
    assert.ok(ok.data.request.startedAt);
  });

  await t.test("worker complete stops tracking", async () => {
    const done = await call(url, worker, "POST", `/requests/${job.id}/complete`);
    assert.equal(done.status, 200);
    assert.equal(done.data.request.status, "completed");
    assert.equal(done.data.request.trackingActive, false);
    assert.equal(done.data.request.workerLat, null);
    const gps = await call(url, worker, "PATCH", `/requests/${job.id}/location`, { lat: 11.1, lng: 77.1 });
    assert.equal(gps.status, 400);
    const tracking = await call(url, customer, "GET", `/requests/${job.id}/tracking`);
    assert.equal(tracking.data.tracking, false);
    assert.equal(tracking.data.latitude, null);
  });

  await t.test("customer confirm completion and cancelled jobs stop tracking", async () => {
    const confirm = await call(url, customer, "POST", `/requests/${job.id}/customer-complete`);
    assert.equal(confirm.status, 200);
    const other = await createJob(url, customer);
    await call(url, worker, "POST", `/requests/${other.id}/accept`, { lat: 11.02, lng: 76.96 });
    const cancelled = await call(url, customer, "POST", `/requests/${other.id}/cancel`, { reason: "Changed plans" });
    assert.equal(cancelled.status, 200);
    const tracking = await call(url, customer, "GET", `/requests/${other.id}/tracking`);
    assert.equal(tracking.data.tracking, false);
    const gps = await call(url, worker, "PATCH", `/requests/${other.id}/location`, { lat: 11.1, lng: 77.1 });
    assert.equal(gps.status, 400);
  });
});
