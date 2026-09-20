import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { WorkerLock } from "../src/models/WorkerLock.js";
import requestRoutes, { calculateJobBill } from "../src/routes/requests.js";
import workerRoutes from "../src/routes/worker.js";
import chatRoutes from "../src/routes/chat.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import { buildLicense } from "../src/utils/license.js";

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_prodflow_test";
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
    console.warn("Skipping Mongo production-flows tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `PF-${Date.now()}-${seq}`;
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
    email: `c-${n}@pf.test`,
    passwordHash: "x",
    role: "customer",
    lat: 12.9716,
    lng: 77.5946,
    license: buildLicense({ days: 30 }),
  });
}

async function makeWorker(name = "Work") {
  const n = nextCode();
  return User.create({
    name: `${name} ${n}`,
    email: `w-${n}@pf.test`,
    passwordHash: "x",
    role: "worker",
    lat: 12.972,
    lng: 77.595,
    license: buildLicense({ days: 30 }),
    provider: {
      available: true,
      onboarded: true,
      businessName: `${name} ${n}`,
      category: "Plumbing",
      skills: [{ name: "Plumbing", verified: true }],
    },
  });
}

function createApp() {
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
  app.use("/worker", workerRoutes);
  app.use("/chat", chatRoutes);
  app.use(errorHandler);
  return listen(app);
}

async function call(baseUrl, user, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-user": String(user._id),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("Production Flow 1: calculateJobBill pure unit test", () => {
  const doc = {
    workerQuote: 800,
    priceChangeRequests: [
      { status: "approved", additionalAmount: 300 },
      { status: "rejected", additionalAmount: 200 },
      { status: "pending", additionalAmount: 150 },
    ],
    materialRequests: [
      { status: "approved", estimatedPrice: 75, quantity: 2 },
      { status: "rejected", estimatedPrice: 50, quantity: 1 },
    ],
  };
  const bill = calculateJobBill(doc);
  assert.equal(bill.baseAmount, 800);
  assert.equal(bill.extraWorkAmount, 300);
  assert.equal(bill.materialsAmount, 150);
  assert.equal(bill.totalAmount, 1250);
});

test("Production Flow 2: Handover, Lock Release, and Re-matching", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker1 = await makeWorker("WorkerOne");
    const worker2 = await makeWorker("WorkerTwo");

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Leaking pipe under kitchen sink",
      estimatedAmount: 500,
    });
    assert.equal(created.status, 201);
    const jobId = created.data.request.id;

    const accept1 = await call(url, worker1, "POST", `/requests/${jobId}/accept`);
    assert.equal(accept1.status, 200);
    assert.equal(accept1.data.request.status, "on_the_way");

    const cust2 = await makeCustomer();
    const job2 = await call(url, cust2, "POST", "/requests", {
      category: "Plumbing",
      description: "Another pipe repair",
      estimatedAmount: 600,
    });
    const acceptConflict = await call(url, worker1, "POST", `/requests/${job2.data.request.id}/accept`);
    assert.equal(acceptConflict.status, 409);

    const handover = await call(url, worker1, "POST", `/requests/${jobId}/handover`, {
      reason: "Emergency family situation",
    });
    assert.equal(handover.status, 200);
    assert.equal(handover.data.request.status, "matching");
    assert.equal(handover.data.request.provider, null);

    const acceptJob2 = await call(url, worker1, "POST", `/requests/${job2.data.request.id}/accept`);
    assert.equal(acceptJob2.status, 200);

    const accept2 = await call(url, worker2, "POST", `/requests/${jobId}/accept`);
    assert.equal(accept2.status, 200);
    assert.equal(accept2.data.request.status, "on_the_way");
    assert.equal(accept2.data.request.provider.id, String(worker2._id));
  } finally {
    server.close();
  }
});

test("Production Flow 3: Price Change Request and Approval", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Fix faucet",
      estimatedAmount: 400,
    });
    const jobId = created.data.request.id;

    await call(url, worker, "POST", `/requests/${jobId}/accept`);
    await call(url, worker, "POST", `/requests/${jobId}/arrive`);
    const jobDoc = await Request.findById(jobId);
    await call(url, worker, "POST", `/requests/${jobId}/verify-otp`, { otp: jobDoc.jobOtp });

    const pcr = await call(url, worker, "POST", `/requests/${jobId}/price-change`, {
      additionalAmount: 200,
      reason: "Found broken valve requiring replacement",
    });
    assert.equal(pcr.status, 200);
    const pcrList = pcr.data.request.priceChangeRequests;
    assert.equal(pcrList.length, 1);
    assert.equal(pcrList[0].status, "pending");
    assert.equal(pcrList[0].additionalAmount, 200);

    const dup = await call(url, worker, "POST", `/requests/${jobId}/price-change`, {
      additionalAmount: 100,
      reason: "Another change",
    });
    assert.equal(dup.status, 409);

    const changeId = pcrList[0].id || pcrList[0]._id;
    const approval = await call(url, cust, "POST", `/requests/${jobId}/price-change/${changeId}/respond`, {
      action: "approve",
    });
    assert.equal(approval.status, 200);
    const updatedPcr = approval.data.request.priceChangeRequests[0];
    assert.equal(updatedPcr.status, "approved");
    assert.equal(approval.data.request.finalBill.totalAmount, 600);
  } finally {
    server.close();
  }
});

test("Production Flow 4: Material Request and Rejection", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Piping work",
      estimatedAmount: 500,
    });
    const jobId = created.data.request.id;

    await call(url, worker, "POST", `/requests/${jobId}/accept`);
    await call(url, worker, "POST", `/requests/${jobId}/arrive`);
    const jobDoc = await Request.findById(jobId);
    await call(url, worker, "POST", `/requests/${jobId}/verify-otp`, { otp: jobDoc.jobOtp });

    const mr = await call(url, worker, "POST", `/requests/${jobId}/material-request`, {
      item: "Brass pipe fitting",
      quantity: 2,
      estimatedPrice: 150,
      reason: "Corroded original fitting",
    });
    assert.equal(mr.status, 200);
    const mrId = mr.data.request.materialRequests[0].id || mr.data.request.materialRequests[0]._id;

    const rejection = await call(url, cust, "POST", `/requests/${jobId}/material-request/${mrId}/respond`, {
      action: "reject",
    });
    assert.equal(rejection.status, 200);
    assert.equal(rejection.data.request.materialRequests[0].status, "rejected");

    const bill = calculateJobBill(rejection.data.request);
    assert.equal(bill.totalAmount, 500);
  } finally {
    server.close();
  }
});

test("Production Flow 5: Final Bill Confirmation and Simulated Payment", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Kitchen pipe installation",
      estimatedAmount: 500,
    });
    const jobId = created.data.request.id;

    await call(url, worker, "POST", `/requests/${jobId}/accept`);
    await call(url, worker, "POST", `/requests/${jobId}/arrive`);
    const jobDoc = await Request.findById(jobId);
    await call(url, worker, "POST", `/requests/${jobId}/verify-otp`, { otp: jobDoc.jobOtp });

    const pcr = await call(url, worker, "POST", `/requests/${jobId}/price-change`, {
      additionalAmount: 200,
      reason: "Extra length of copper pipe",
    });
    const pcrId = pcr.data.request.priceChangeRequests[0].id || pcr.data.request.priceChangeRequests[0]._id;
    await call(url, cust, "POST", `/requests/${jobId}/price-change/${pcrId}/respond`, { action: "approve" });

    const completed = await call(url, worker, "POST", `/requests/${jobId}/complete`);
    assert.equal(completed.status, 200);

    const prematureCollect = await call(url, worker, "POST", `/requests/${jobId}/collect-payment`);
    assert.equal(prematureCollect.status, 400);

    const confirmBill = await call(url, cust, "POST", `/requests/${jobId}/confirm-bill`);
    assert.equal(confirmBill.status, 200);
    assert.equal(confirmBill.data.request.finalBill.confirmedByCustomer, true);
    assert.equal(confirmBill.data.request.finalBill.totalAmount, 700);

    const collect = await call(url, worker, "POST", `/requests/${jobId}/collect-payment`);
    assert.equal(collect.status, 200);
    assert.equal(collect.data.request.paymentStatus, "collected");
  } finally {
    server.close();
  }
});

test("Production Flow 6: Chat is Gated by Job Acceptance", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Drain blockage",
      estimatedAmount: 450,
    });
    const jobId = created.data.request.id;

    const chatPre = await call(url, worker, "POST", "/chat/open", { requestId: jobId });
    assert.equal(chatPre.status, 403);

    await call(url, worker, "POST", `/requests/${jobId}/accept`);
    const chatPost = await call(url, worker, "POST", "/chat/open", { requestId: jobId });
    assert.equal(chatPost.status, 200);
    assert.ok(chatPost.data.conversationId);
  } finally {
    server.close();
  }
});

test("Production Flow 7: Heatmap Aggregates and Protects Customer Coordinates", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Sink issue 1",
      lat: 12.9716,
      lng: 77.5946,
      area: "Indiranagar",
    });
    await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Sink issue 2",
      lat: 12.9718,
      lng: 77.5948,
      area: "Indiranagar",
    });

    const heatmap = await call(url, worker, "GET", "/worker/job-demand-heatmap");
    assert.equal(heatmap.status, 200);
    assert.ok(Array.isArray(heatmap.data.clusters));
    assert.ok(heatmap.data.clusters.length >= 1);
    const cluster = heatmap.data.clusters[0];
    assert.ok(cluster.count >= 2);
    assert.equal(cluster.lat, 12.98);
    assert.equal(cluster.lng, 77.6);
  } finally {
    server.close();
  }
});

test("Production Flow 8: Worker Reliability Profile & Milestones", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const worker = await makeWorker();
    const rel = await call(url, worker, "GET", "/worker/reliability-profile");
    assert.equal(rel.status, 200);
    assert.ok(rel.data.reliability);
    assert.equal(typeof rel.data.reliability.completedJobs, "number");
    assert.equal(typeof rel.data.reliability.onTimePct, "number");
    assert.ok(Array.isArray(rel.data.milestones));
    assert.ok(rel.data.milestones.length >= 5);
  } finally {
    server.close();
  }
});

test("Production Flow 9: Reschedule flow", async (t) => {
  if (!mongoReady) return t.skip("mongo not connected");
  const { server, url } = await createApp();
  try {
    const cust = await makeCustomer();
    const worker = await makeWorker();

    const created = await call(url, cust, "POST", "/requests", {
      category: "Plumbing",
      description: "Scheduled checkup",
      timing: "scheduled",
      scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    const jobId = created.data.request.id;

    await call(url, worker, "POST", `/requests/${jobId}/accept`);

    const newDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const resched = await call(url, cust, "POST", `/requests/${jobId}/reschedule-request`, {
      proposedAt: newDate,
      reason: "Travelling tomorrow",
    });
    assert.equal(resched.status, 200);
    assert.equal(resched.data.request.rescheduleRequest.status, "pending");

    const acceptResched = await call(url, worker, "POST", `/requests/${jobId}/reschedule-respond`, {
      action: "accept",
    });
    assert.equal(acceptResched.status, 200);
    assert.equal(acceptResched.data.request.rescheduleRequest, null);
    assert.equal(acceptResched.data.request.rescheduleHistory.length, 1);
    assert.equal(acceptResched.data.request.rescheduleHistory[0].status, "accepted");
  } finally {
    server.close();
  }
});
