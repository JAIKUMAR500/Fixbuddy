import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { km, hasCoords, OPEN_JOB_STATUSES } from "../src/utils/geo.js";
import { hasValidLicense } from "../src/utils/license.js";
import {
  ENGAGED_JOB_STATUSES,
  PENDING_JOB_STATUSES,
  CLOSED_JOB_STATUSES,
  approxCoord,
  isEngagedJobStatus,
} from "../src/utils/jobLock.js";
import { presentRequest } from "../src/utils/serialize.js";
import { User } from "../src/models/User.js";
import { WorkerPassport } from "../src/models/WorkerPassport.js";
import { Request } from "../src/models/Request.js";
import {
  loadPassport,
  jobMatchesWorkerSkills,
  filterJobsForWorker,
  workerHasSkills,
  workerSkillLabels,
} from "../src/utils/workerPower.js";
import workerRoutes from "../src/routes/worker.js";
import requestRoutes from "../src/routes/requests.js";
import adminRoutes from "../src/routes/admin.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import { NO_ACCESS_MESSAGE } from "../src/utils/jobLock.js";
test("worker skill matching tolerates aliases and rejects unrelated categories", () => {
  const plumber = {
    _id: "w1",
    provider: { category: "Plumber", skills: [{ name: "Pipe Repair" }, { name: "Bathroom Plumbing" }] },
  };
  const multi = {
    _id: "w2",
    provider: { category: "Plumbing", skills: [{ name: "Electrician" }] },
  };
  const empty = { _id: "w3", provider: {} };

  assert.equal(jobMatchesWorkerSkills(plumber, { category: "Plumbing" }), true);
  assert.equal(jobMatchesWorkerSkills(plumber, { category: "Pipe leakage repair" }), true);
  assert.equal(jobMatchesWorkerSkills(plumber, { category: "House Painting" }), false);
  assert.equal(jobMatchesWorkerSkills(plumber, { category: "Deep cleaning" }), false);
  assert.equal(jobMatchesWorkerSkills(multi, { category: "Electrical" }), true);
  assert.equal(jobMatchesWorkerSkills(multi, { category: "Plumbing" }), true);
  assert.equal(jobMatchesWorkerSkills(empty, { category: "Plumbing" }), false);
  assert.equal(
    jobMatchesWorkerSkills(empty, { category: "Plumbing", invitedProviderIds: ["w3"] }),
    true
  );

  const jobs = [
    { _id: "1", category: "Plumbing", status: "open" },
    { _id: "2", category: "Painting", status: "open" },
    { _id: "3", category: "Electrical", status: "open" },
  ];
  assert.deepEqual(
    filterJobsForWorker(plumber, jobs).map((j) => j.category),
    ["Plumbing"]
  );
  assert.deepEqual(
    filterJobsForWorker(multi, jobs).map((j) => j.category).sort(),
    ["Electrical", "Plumbing"]
  );
  assert.equal(filterJobsForWorker(empty, jobs).length, 0);
  assert.equal(workerHasSkills(plumber), true);
  assert.equal(workerHasSkills(empty), false);
  assert.ok(workerSkillLabels(plumber).includes("Plumber"));
});

test("recommended jobs use only open lifecycle statuses", () => {
  assert.deepEqual(OPEN_JOB_STATUSES, ["matching", "open", "requested"]);
  assert.equal(OPEN_JOB_STATUSES.includes("completed"), false);
  assert.equal(OPEN_JOB_STATUSES.includes("cancelled"), false);
});

test("admin license remains valid without an expiry date", () => {
  assert.equal(hasValidLicense({ role: "admin", license: { status: "revoked" } }), true);
});

test("active worker license must not be expired", () => {
  assert.equal(hasValidLicense({ role: "worker", license: { status: "active", expiresAt: new Date(Date.now() + 60_000) } }), true);
  assert.equal(hasValidLicense({ role: "worker", license: { status: "active", expiresAt: new Date(Date.now() - 60_000) } }), false);
});

test("job focus uses existing engaged statuses until paid or cancelled", () => {
  assert.deepEqual(PENDING_JOB_STATUSES, ["matching", "open", "requested"]);
  for (const status of ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"]) {
    assert.equal(isEngagedJobStatus(status), true);
  }
  for (const status of ["matching", "open", "requested", "payment_collected", "customer_completed", "reviewed", "cancelled", "declined"]) {
    assert.equal(isEngagedJobStatus(status), false);
  }
  assert.equal(ENGAGED_JOB_STATUSES.includes("payment_collected"), false);
  assert.equal(CLOSED_JOB_STATUSES.includes("cancelled"), true);
});

test("coordinate 0 is a valid GPS value", () => {
  assert.equal(hasCoords(0, 0), true);
  assert.equal(hasCoords(null, 76.9), false);
  assert.equal(km(0, 0, 0, 1) != null, true);
});

test("unassigned workers only see approximate customer coordinates", () => {
  const hidden = presentRequest(
    { _id: "1", status: "matching", lat: 11.0168, lng: 76.9558, tower: "A", flat: "12", gateNote: "gate", workerLat: 11.02, workerLng: 76.96 },
    { hideContact: true }
  );
  assert.equal(hidden.lat, approxCoord(11.0168));
  assert.equal(hidden.lng, approxCoord(76.9558));
  assert.equal(hidden.flat, "");
  assert.equal(hidden.tower, "");
  assert.equal(hidden.workerLat, null);
  const shown = presentRequest(
    { _id: "1", status: "on_the_way", lat: 11.0168, lng: 76.9558, workerLat: 11.02, workerLng: 76.96 },
    { hideContact: false }
  );
  assert.equal(shown.lat, 11.0168);
  assert.equal(shown.workerLat, 11.02);
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_skill_test";
let mongoReady = false;
let seq = 0;

async function connectTestDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
  await mongoose.connection.dropDatabase();
}

test.before(async () => {
  try {
    await connectTestDb();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo skill-verification tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `SK-${Date.now()}-${seq}`;
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

async function json(url, method, path, body, userId) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-user": String(userId) },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
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
  app.use("/api/worker", workerRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  return app;
}

test("worker skill verification appears in the admin queue and updates the passport", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const worker = await User.create({
    name: `Work ${nextCode()}`,
    email: `w-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "worker",
    provider: { available: true, businessName: "Skill Worker" },
  });
  const admin = await User.create({
    name: "Admin",
    email: `a-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "admin",
  });
  const { server, url } = await listen(appServer());
  try {
    const added = await json(url, "POST", "/api/worker/skills", { name: "Plumbing" }, worker._id);
    assert.equal(added.status, 201);
    const skillId = added.data.skills[0].id;
    const pending = await json(url, "POST", `/api/worker/skills/${skillId}/verify`, {}, worker._id);
    assert.equal(pending.status, 200);
    assert.equal(pending.data.skill.pending, true);

    const queue = await json(url, "GET", "/api/admin/skill-verification", null, admin._id);
    assert.equal(queue.status, 200);
    const row = (queue.data.skills || []).find((s) => s.name === "Plumbing" && s.workerId === String(worker._id));
    assert.ok(row, "pending skill should appear in the admin queue");

    const approved = await json(url, "PATCH", `/api/admin/skill-verification/${worker._id}/${row.id}`, { status: "verified" }, admin._id);
    assert.equal(approved.status, 200);

    const fresh = await User.findById(worker._id);
    const pack = await loadPassport(fresh);
    assert.equal(pack.skills.some((s) => s.name === "Plumbing" && s.verified), true);
    assert.ok(pack.badges.some((b) => b.id === "skill-verified"));
    const passport = await WorkerPassport.findOne({ workerId: worker._id });
    assert.equal(passport.skills.some((s) => s.name === "Plumbing" && s.verificationStatus === "verified"), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("nearby jobs and request GET enforce skill matching", async (t) => {
  if (!mongoReady) return t.skip("MongoDB is not available");
  const customer = await User.create({
    name: "Cust",
    email: `c-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "customer",
  });
  const plumber = await User.create({
    name: "Plumber",
    email: `p-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "worker",
    provider: {
      available: true,
      nextJobAvailable: true,
      businessName: "Pipe Pros",
      category: "Plumbing",
      skills: [{ name: "Plumbing" }, { name: "Pipe Repair" }],
    },
  });
  const painter = await User.create({
    name: "Painter",
    email: `paint-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "worker",
    provider: {
      available: true,
      nextJobAvailable: true,
      businessName: "Paint Co",
      category: "Painting",
      skills: [{ name: "Painting" }],
    },
  });
  const noSkills = await User.create({
    name: "New",
    email: `new-${nextCode()}@skill.test`,
    passwordHash: "x",
    role: "worker",
    provider: { available: true, nextJobAvailable: true, businessName: "New Worker" },
  });
  const plumbingJob = await Request.create({
    code: nextCode(),
    customerId: customer._id,
    description: "Pipe leak",
    category: "Plumbing",
    status: "open",
    publicPost: true,
    estimatedAmount: 800,
  });
  const paintingJob = await Request.create({
    code: nextCode(),
    customerId: customer._id,
    description: "Wall paint",
    category: "Painting",
    status: "open",
    publicPost: true,
    estimatedAmount: 1200,
  });
  const electricalJob = await Request.create({
    code: nextCode(),
    customerId: customer._id,
    description: "Fan fix",
    category: "Electrical",
    status: "open",
    publicPost: true,
    estimatedAmount: 500,
  });

  const { server, url } = await listen(appServer());
  try {
    const nearbyPlumber = await json(url, "GET", "/api/worker/nearby-jobs", null, plumber._id);
    assert.equal(nearbyPlumber.status, 200);
    assert.equal(nearbyPlumber.data.hasSkills, true);
    const plumberCats = (nearbyPlumber.data.jobs || []).map((j) => j.category);
    assert.ok(plumberCats.includes("Plumbing"));
    assert.equal(plumberCats.includes("Painting"), false);
    assert.equal(plumberCats.includes("Electrical"), false);

    const nearbyNone = await json(url, "GET", "/api/worker/nearby-jobs", null, noSkills._id);
    assert.equal(nearbyNone.status, 200);
    assert.equal(nearbyNone.data.hasSkills, false);
    assert.equal((nearbyNone.data.jobs || []).length, 0);

    const allow = await json(url, "GET", `/api/requests/${plumbingJob._id}`, null, plumber._id);
    assert.equal(allow.status, 200);

    const deny = await json(url, "GET", `/api/requests/${paintingJob._id}`, null, plumber._id);
    assert.equal(deny.status, 403);
    assert.equal(deny.data.message, NO_ACCESS_MESSAGE);

    const denyElectrical = await json(url, "GET", `/api/requests/${electricalJob._id}`, null, plumber._id);
    assert.equal(denyElectrical.status, 403);

    const painterOk = await json(url, "GET", `/api/requests/${paintingJob._id}`, null, painter._id);
    assert.equal(painterOk.status, 200);

    const acceptBad = await json(url, "POST", `/api/requests/${paintingJob._id}/accept`, {}, plumber._id);
    assert.equal(acceptBad.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
