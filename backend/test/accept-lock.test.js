import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { WorkerLock } from "../src/models/WorkerLock.js";
import requestRoutes from "../src/routes/requests.js";
import crewRoutes from "../src/routes/crews.js";
import { Crew } from "../src/models/Crew.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import {
  LOCK_MESSAGE,
  PENDING_JOB_STATUSES,
  acquireWorkerLock,
  claimableJobFilter,
  isDuplicateKeyError,
  isEngagedJobStatus,
  releaseLocksForJob,
} from "../src/utils/jobLock.js";

test("duplicate key helper recognizes Mongo E11000", () => {
  assert.equal(isDuplicateKeyError({ code: 11000 }), true);
  assert.equal(isDuplicateKeyError({ code: 11001 }), true);
  assert.equal(isDuplicateKeyError({ code: 1 }), false);
  assert.equal(isDuplicateKeyError(null), false);
});

test("claimable jobs are only pending and unassigned (or same worker)", () => {
  const filter = claimableJobFilter("job1", "worker1");
  assert.deepEqual(filter.status, { $in: PENDING_JOB_STATUSES });
  assert.equal(PENDING_JOB_STATUSES.includes("accepted"), false);
  assert.ok(filter.$or.some((part) => part.providerId === null));
});

test("engaged vs closed statuses are unchanged from Phase 1", () => {
  for (const status of ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"]) {
    assert.equal(isEngagedJobStatus(status), true);
  }
  for (const status of ["payment_collected", "customer_completed", "reviewed", "cancelled"]) {
    assert.equal(isEngagedJobStatus(status), false);
  }
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_lock_test";
let mongoReady = false;
let seq = 0;

async function connectTestDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
  await mongoose.connection.dropDatabase();
  await WorkerLock.syncIndexes();
  try {
    await Request.syncIndexes();
  } catch (err) {
    console.warn("Request unique engaged index:", err.message);
  }
}

test.before(async () => {
  try {
    await connectTestDb();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo accept-lock tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `LOCK-${Date.now()}-${seq}`;
}

async function makeCustomer() {
  const n = nextCode();
  return User.create({ name: `Cust ${n}`, email: `c-${n}@lock.test`, passwordHash: "x", role: "customer" });
}

async function makeWorker() {
  const n = nextCode();
  return User.create({
    name: `Work ${n}`,
    email: `w-${n}@lock.test`,
    passwordHash: "x",
    role: "worker",
    provider: {
      available: true,
      businessName: `Work ${n}`,
      category: "AC Repair & Service",
      skills: [
        { name: "AC Repair & Service" },
        { name: "Plumbing" },
        { name: "Electrical" },
        { name: "Painting" },
        { name: "Cleaning" },
        { name: "Carpentry" },
      ],
    },
  });
}

async function makeJob(customerId, status = "open") {
  return Request.create({
    code: nextCode(),
    customerId,
    description: "Test job",
    category: "AC Repair & Service",
    status,
    estimatedAmount: 400,
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
  app.use("/crews", crewRoutes);
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
    headers: {
      "Content-Type": "application/json",
      "x-test-user": String(user._id),
    },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("TEST 1-10: atomic worker acceptance against MongoDB", async (t) => {
  if (!mongoReady) {
    t.skip("local MongoDB is not available");
    return;
  }

  const { server, url } = await appServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  await t.test("TEST 1: worker accepts Job A", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const res = await call(url, worker, "POST", `/requests/${jobA._id}/accept`);
    assert.equal(res.status, 200);
    assert.equal(res.data.request.status, "on_the_way");
    assert.equal(res.data.request.providerId, String(worker._id));
    const lock = await WorkerLock.findOne({ userId: worker._id }).lean();
    assert.equal(String(lock.jobId), String(jobA._id));
  });

  await t.test("TEST 2: worker cannot accept Job B while A is engaged; B stays available", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const jobB = await makeJob(customer._id);
    const first = await call(url, worker, "POST", `/requests/${jobA._id}/accept`);
    assert.equal(first.status, 200);
    const second = await call(url, worker, "POST", `/requests/${jobB._id}/accept`);
    assert.equal(second.status, 409);
    assert.equal(second.data.message, LOCK_MESSAGE);
    const stillB = await Request.findById(jobB._id).lean();
    assert.equal(stillB.status, "open");
    assert.equal(stillB.providerId, null);
  });

  await t.test("TEST 3: double accept of the same job is idempotent", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const first = await call(url, worker, "POST", `/requests/${jobA._id}/accept`);
    const second = await call(url, worker, "POST", `/requests/${jobA._id}/accept`);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.data.request.providerId, String(worker._id));
    const locks = await WorkerLock.countDocuments({ userId: worker._id });
    assert.equal(locks, 1);
    const assigned = await Request.countDocuments({ providerId: worker._id, status: { $in: ["accepted", "on_the_way"] } });
    assert.equal(assigned, 1);
  });

  await t.test("TEST 4: two workers racing the same job — exactly one wins", async () => {
    const customer = await makeCustomer();
    const w1 = await makeWorker();
    const w2 = await makeWorker();
    const jobA = await makeJob(customer._id);
    const [a, b] = await Promise.all([
      call(url, w1, "POST", `/requests/${jobA._id}/accept`),
      call(url, w2, "POST", `/requests/${jobA._id}/accept`),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 409 ? a : b;
    assert.match(loser.data.message, /already accepted|no longer available/i);
    const stored = await Request.findById(jobA._id).lean();
    assert.equal(["accepted", "on_the_way"].includes(stored.status), true);
    assert.ok([String(w1._id), String(w2._id)].includes(String(stored.providerId)));
    assert.equal(String(winner.data.request.providerId), String(stored.providerId));
  });

  await t.test("TEST 5: same worker racing two jobs — exactly one engaged job", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const jobB = await makeJob(customer._id);
    const [a, b] = await Promise.all([
      call(url, worker, "POST", `/requests/${jobA._id}/accept`),
      call(url, worker, "POST", `/requests/${jobB._id}/accept`),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const engaged = await Request.find({ providerId: worker._id, status: { $in: ["accepted", "on_the_way"] } }).lean();
    assert.equal(engaged.length, 1);
    const locks = await WorkerLock.find({ userId: worker._id }).lean();
    assert.equal(locks.length, 1);
    const failedId = a.status === 409 ? jobA._id : jobB._id;
    const leftover = await Request.findById(failedId).lean();
    assert.equal(leftover.providerId, null);
    assert.equal(["open", "matching", "requested"].includes(leftover.status), true);
  });

  await t.test("TEST 6: after payment_collected the worker can accept another job", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const jobB = await makeJob(customer._id);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/accept`)).status, 200);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/enroute`)).status, 200);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/arrive`)).status, 200);
    const otpDoc = await Request.findById(jobA._id).select("jobOtp").lean();
    const otp = await call(url, worker, "POST", `/requests/${jobA._id}/verify-otp`, { otp: otpDoc.jobOtp });
    assert.equal(otp.status, 200);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/start`)).status, 200);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/complete`)).status, 200);
    const stillLocked = await call(url, worker, "POST", `/requests/${jobB._id}/accept`);
    assert.equal(stillLocked.status, 409);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/collect-payment`)).status, 200);
    const after = await call(url, worker, "POST", `/requests/${jobB._id}/accept`);
    assert.equal(after.status, 200);
    assert.equal(after.data.request.providerId, String(worker._id));
  });

  await t.test("TEST 7: cancelled job releases the worker", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const jobB = await makeJob(customer._id);
    assert.equal((await call(url, worker, "POST", `/requests/${jobA._id}/accept`)).status, 200);
    const cancelled = await call(url, worker, "POST", `/requests/${jobA._id}/cancel`, { reason: "Test cancel" });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.request.status, "cancelled");
    const lock = await WorkerLock.findOne({ userId: worker._id }).lean();
    assert.equal(lock, null);
    const next = await call(url, worker, "POST", `/requests/${jobB._id}/accept`);
    assert.equal(next.status, 200);
  });

  await t.test("TEST 8: current-job returns the engaged job after accept", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    await call(url, worker, "POST", `/requests/${jobA._id}/accept`);
    const current = await call(url, worker, "GET", "/requests/current-job");
    assert.equal(current.status, 200);
    assert.equal(current.data.locked, true);
    assert.equal(current.data.request.id, String(jobA._id));
  });

  await t.test("TEST 9: customer Phase 1 current-job and create-block still work", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const created = await call(url, customer, "POST", "/requests", {
      description: "Need AC service today",
      category: "AC Repair & Service",
    });
    assert.equal(created.status, 201);
    const jobId = created.data.request.id;
    await call(url, worker, "POST", `/requests/${jobId}/accept`);
    const current = await call(url, customer, "GET", "/requests/current-job");
    assert.equal(current.status, 200);
    assert.equal(current.data.locked, true);
    assert.equal(current.data.request.id, jobId);
    const blocked = await call(url, customer, "POST", "/requests", {
      description: "Second job should wait",
      category: "AC Repair & Service",
    });
    assert.equal(blocked.status, 409);
    assert.match(blocked.data.message, /current job is active/i);
  });

  await t.test("TEST 10: customers cannot call worker accept", async () => {
    const customer = await makeCustomer();
    const job = await makeJob(customer._id);
    const res = await call(url, customer, "POST", `/requests/${job._id}/accept`);
    assert.equal(res.status, 403);
    const open = await Request.findById(job._id).lean();
    assert.equal(open.providerId, null);
  });

  await t.test("crew accept races solo accept — exactly one assignment", async () => {
    const customer = await makeCustomer();
    const leader = await makeWorker();
    const solo = await makeWorker();
    const crew = await Crew.create({
      name: "Lock Crew",
      leaderId: leader._id,
      members: [{ userId: leader._id, role: "leader", status: "active" }],
    });
    const job = await makeJob(customer._id);
    job.crewId = crew._id;
    job.workersRequired = 1;
    await job.save();
    const [crewRes, soloRes] = await Promise.all([
      call(url, leader, "POST", `/crews/${crew._id}/jobs/${job._id}/accept`, { memberIds: [String(leader._id)] }),
      call(url, solo, "POST", `/requests/${job._id}/accept`),
    ]);
    const wins = [crewRes, soloRes].filter((r) => r.status === 200);
    const losses = [crewRes, soloRes].filter((r) => r.status === 409);
    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
    const stored = await Request.findById(job._id).lean();
    assert.equal(["accepted", "on_the_way"].includes(stored.status), true);
    const engagedWorkers = await Request.countDocuments({
      _id: job._id,
      status: { $in: ["accepted", "on_the_way"] },
      $or: [{ providerId: leader._id }, { providerId: solo._id }],
    });
    assert.equal(engagedWorkers, 1);
  });

  await t.test("lock collection serializes two jobs for one worker", async () => {
    const customer = await makeCustomer();
    const worker = await makeWorker();
    const jobA = await makeJob(customer._id);
    const jobB = await makeJob(customer._id);
    const [a, b] = await Promise.allSettled([
      acquireWorkerLock(worker._id, jobA._id),
      acquireWorkerLock(worker._id, jobB._id),
    ]);
    const ok = [a, b].filter((r) => r.status === "fulfilled");
    const bad = [a, b].filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(bad.length, 1);
    assert.equal(bad[0].reason.status, 409);
    assert.equal(bad[0].reason.message, LOCK_MESSAGE);
    await releaseLocksForJob(jobA._id);
    await releaseLocksForJob(jobB._id);
  });
});
