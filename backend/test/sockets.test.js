import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { io as ioc } from "socket.io-client";
import { createApp } from "../src/app.js";
import { attachRealtime, closeRealtime } from "../src/realtime/io.js";
import { canJoinJobRoom, canJoinUserRoom, canPublishLocation, parseRoom } from "../src/realtime/access.js";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import { buildLicense } from "../src/utils/license.js";

test("room parser only accepts user and job rooms", () => {
  assert.deepEqual(parseRoom("user:64f0c0c0c0c0c0c0c0c0c0c0"), { kind: "user", id: "64f0c0c0c0c0c0c0c0c0c0c0" });
  assert.deepEqual(parseRoom("job:64f0c0c0c0c0c0c0c0c0c0c1"), { kind: "job", id: "64f0c0c0c0c0c0c0c0c0c0c1" });
  assert.equal(parseRoom("admin:1"), null);
  assert.equal(parseRoom("job:not-an-id"), null);
});

test("job rooms are limited to assigned participants", () => {
  const customer = { _id: "c1", role: "customer" };
  const worker = { _id: "w1", role: "worker" };
  const stranger = { _id: "w2", role: "worker" };
  const admin = { _id: "a1", role: "admin" };
  const openJob = { customerId: "c1", providerId: null, status: "open" };
  const accepted = { customerId: "c1", providerId: "w1", status: "on_the_way", crewMemberIds: [] };

  assert.equal(canJoinJobRoom(customer, openJob), true);
  assert.equal(canJoinJobRoom(stranger, openJob), false);
  assert.equal(canJoinJobRoom(worker, accepted), true);
  assert.equal(canJoinJobRoom(stranger, accepted), false);
  assert.equal(canJoinJobRoom(admin, accepted), true);
  assert.equal(canJoinUserRoom(worker, "w2"), false);
  assert.equal(canJoinUserRoom(worker, "w1"), true);
});

test("GPS publish stops after the job is completed or cancelled", () => {
  const worker = { _id: "w1", role: "worker" };
  const tracking = { customerId: "c1", providerId: "w1", status: "on_the_way" };
  assert.equal(canPublishLocation(worker, tracking), true);
  assert.equal(canPublishLocation(worker, { ...tracking, status: "completed" }), false);
  assert.equal(canPublishLocation(worker, { ...tracking, status: "cancelled" }), false);
  assert.equal(canPublishLocation(worker, { ...tracking, status: "payment_collected" }), false);
  assert.equal(canPublishLocation({ _id: "w2", role: "worker" }, tracking), false);
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_socket_test";
let mongoReady = false;
let seq = 0;

test.before(async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo socket tests:", err.message);
  }
});

test.after(async () => {
  await closeRealtime();
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function nextCode() {
  seq += 1;
  return `SOCK-${Date.now()}-${seq}`;
}

async function listenRealtime() {
  const app = createApp();
  const server = http.createServer(app);
  attachRealtime(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

async function signup(url, role) {
  const email = `${nextCode()}-${role}@sock.test`.toLowerCase();
  const res = await fetch(`${url}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${role} ${email}`,
      email,
      password: "SockPass1",
      role,
      city: "Coimbatore",
      area: "Peelamedu",
      lat: 11.01,
      lng: 76.95,
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 201, data.message);
  if (role === "worker") {
    await User.updateOne(
      { _id: data.user.id },
      { $set: { license: buildLicense({ days: 30 }), "provider.onboarded": true, "provider.available": true } },
    );
  }
  return { ...data, email };
}

function connectClient(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioc(url, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("socket connect timeout"));
    }, 4000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test("unauthenticated sockets are rejected", async () => {
  if (!mongoReady) return;
  const { server, url } = await listenRealtime();
  try {
    await assert.rejects(() => connectClient(url, ""), /Sign in required|websocket error|unauthorized/i);
  } finally {
    await closeRealtime();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("job room, chat, status, GPS, and completed-job GPS shutdown", async () => {
  if (!mongoReady) return;
  const { server, url } = await listenRealtime();
  try {
    const customer = await signup(url, "customer");
    const worker = await signup(url, "worker");
    const stranger = await signup(url, "worker");

    const created = await fetch(`${url}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({
        category: "Plumbing",
        description: "Socket leak",
        address: "12 Test Street",
        area: "Peelamedu",
        city: "Coimbatore",
        timing: "asap",
        publicPost: true,
        estimatedAmount: 800,
        lat: 11.0168,
        lng: 76.9558,
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201, createdBody.message);
    const jobId = createdBody.request.id;

    const accept = await fetch(`${url}/api/requests/${jobId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${worker.token}` },
    });
    const acceptBody = await accept.json();
    assert.equal(accept.status, 200, acceptBody.message);
    assert.equal(acceptBody.request.status, "on_the_way");

    const [customerSock, workerSock, strangerSock] = await Promise.all([
      connectClient(url, customer.token),
      connectClient(url, worker.token),
      connectClient(url, stranger.token),
    ]);

    const join = (sock, id) =>
      new Promise((resolve) => sock.emit("job:join", { requestId: id }, (ack) => resolve(ack)));

    const customerJoin = await join(customerSock, jobId);
    const workerJoin = await join(workerSock, jobId);
    const strangerJoin = await join(strangerSock, jobId);
    assert.equal(customerJoin.ok, true);
    assert.equal(workerJoin.ok, true);
    assert.equal(strangerJoin.ok, false);

    const locSeen = [];
    customerSock.on("location:update", (payload) => locSeen.push(payload));
    strangerSock.on("location:update", (payload) => locSeen.push({ ...payload, stranger: true }));

    const enroute = await fetch(`${url}/api/requests/${jobId}/enroute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${worker.token}` },
      body: JSON.stringify({ lat: 11.02, lng: 76.96 }),
    });
    assert.equal(enroute.status, 200, await enroute.text());

    const locAck = await new Promise((resolve) => {
      workerSock.emit("location:update", { requestId: jobId, lat: 11.03, lng: 76.97, jobId, workerId: worker.user?.id }, (ack) => resolve(ack));
    });
    assert.equal(locAck.ok, true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.ok(locSeen.some((event) => event.latitude === 11.03 || event.lat === 11.03));
    assert.equal(locSeen.some((event) => event.stranger), false);

    const conv = await fetch(`${url}/api/conversations/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({ requestId: jobId }),
    });
    const convBody = await conv.json();
    assert.equal(conv.status, 200, convBody.message);

    const chatSeen = [];
    workerSock.on("chat:message", (payload) => chatSeen.push(payload));
    const sent = await fetch(`${url}/api/conversations/${convBody.conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({ text: "I am at the gate" }),
    });
    assert.equal(sent.status, 201, await sent.text());
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(chatSeen.some((event) => event.message?.text === "I am at the gate"));

    await Request.updateOne({ _id: jobId }, { $set: { status: "completed" } });
    const afterComplete = await new Promise((resolve) => {
      workerSock.emit("location:update", { requestId: jobId, lat: 11.04, lng: 76.98 }, (ack) => resolve(ack));
    });
    assert.equal(afterComplete.ok, false);

    workerSock.disconnect();
    const reconnected = await connectClient(url, worker.token);
    assert.equal(reconnected.connected, true);
    reconnected.disconnect();

    customerSock.disconnect();
    strangerSock.disconnect();
  } finally {
    await closeRealtime();
    await new Promise((resolve) => server.close(resolve));
  }
});
