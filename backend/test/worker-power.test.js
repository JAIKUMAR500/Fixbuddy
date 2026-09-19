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
import { loadPassport } from "../src/utils/workerPower.js";
import workerRoutes from "../src/routes/worker.js";
import adminRoutes from "../src/routes/admin.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";

test("nearby-job distance is calculated in kilometers", () => {
  const distance = km(11.0168, 76.9558, 11.0268, 76.9658);
  assert.ok(distance > 1 && distance < 2);
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
