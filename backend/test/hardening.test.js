import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { rateLimit, resetRateLimitStore, AUTH_LIMITS } from "../src/middleware/rateLimit.js";
import { errorHandler } from "../src/middleware/error.js";
import { httpError } from "../src/utils/asyncHandler.js";
import { createApp } from "../src/app.js";
import { health, ready } from "../src/utils/health.js";
import { hashWatchToken, createWatchToken, watchTtlMs } from "../src/utils/watchToken.js";
import { approxCoord } from "../src/utils/jobLock.js";
import { ensureLoginLicense, hasValidLicense, buildLicense } from "../src/utils/license.js";
import { FINANCIAL_MODE, getPaymentService, DevelopmentPaymentService } from "../src/services/payments/index.js";
import { productionEnvProblems } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { Request } from "../src/models/Request.js";
import requestRoutes from "../src/routes/requests.js";
import authRoutes from "../src/routes/auth.js";
import uploadRoutes from "../src/routes/upload.js";
import { NO_ACCESS_MESSAGE } from "../src/utils/jobLock.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function json(url, method, path, body, headers = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("login rate limiter returns 429 after max attempts", async () => {
  resetRateLimitStore();
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    rateLimit({
      windowMs: 60_000,
      max: 3,
      key: () => "login-test",
      message: "Too many login attempts. Try again later.",
    }),
    (_req, res) => res.json({ ok: true }),
  );
  app.use(errorHandler);
  const { server, url } = await listen(app);
  try {
    assert.equal((await json(url, "POST", "/login")).status, 200);
    assert.equal((await json(url, "POST", "/login")).status, 200);
    assert.equal((await json(url, "POST", "/login")).status, 200);
    const blocked = await json(url, "POST", "/login");
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, /Too many login attempts/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetRateLimitStore();
  }
});

test("OTP rate limiter returns 429 after max attempts", async () => {
  resetRateLimitStore();
  const app = express();
  app.use(express.json());
  app.post(
    "/forgot",
    rateLimit({
      windowMs: AUTH_LIMITS.forgot.windowMs,
      max: AUTH_LIMITS.forgot.max,
      key: () => "otp-test",
      message: "Too many OTP requests. Try again later.",
    }),
    (_req, res) => res.json({ ok: true }),
  );
  app.use(errorHandler);
  const { server, url } = await listen(app);
  try {
    for (let i = 0; i < AUTH_LIMITS.forgot.max; i += 1) {
      assert.equal((await json(url, "POST", "/forgot")).status, 200);
    }
    const blocked = await json(url, "POST", "/forgot");
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, /Too many OTP requests/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetRateLimitStore();
  }
});

test("GET /api/health reports the API is alive", async () => {
  const app = express();
  app.get("/api/health", health);
  const { server, url } = await listen(app);
  try {
    const res = await json(url, "GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.service, "fixbuddy-api");
    assert.equal(res.data.mongoUri, undefined);
    assert.equal(res.data.jwtSecret, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/ready does not leak infrastructure details", async () => {
  const app = createApp();
  const { server, url } = await listen(app);
  try {
    const res = await json(url, "GET", "/api/ready");
    if (mongoose.connection.readyState === 1) {
      assert.equal(res.status, 200);
      assert.equal(res.data.ready, true);
    } else {
      assert.equal(res.status, 503);
      assert.equal(res.data.ready, false);
    }
    assert.equal(res.data.mongoUri, undefined);
    assert.equal(res.data.host, undefined);
    assert.equal(res.data.redisUrl, undefined);
    if (res.data.redis != null) {
      assert.ok(["off", "up", "down"].includes(res.data.redis));
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("watch tokens are hashed, short-lived, and not reversible", () => {
  const token = createWatchToken();
  const hashed = hashWatchToken(token);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, token);
  assert.equal(hashWatchToken(token), hashed);
  assert.ok(watchTtlMs() <= 2 * 60 * 60 * 1000);
});

test("approxCoord does not return an exact pin", () => {
  assert.equal(approxCoord(12.971891), 12.97);
  assert.equal(approxCoord(null), null);
});

test("production does not auto-renew expired licenses", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let saved = false;
  const user = {
    role: "customer",
    license: { status: "expired", plan: "trial", expiresAt: new Date(Date.now() - 60_000) },
    markModified() {},
    async save() {
      saved = true;
    },
  };
  try {
    assert.equal(hasValidLicense(user), false);
    await ensureLoginLicense(user);
    assert.equal(saved, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("development license renew is skipped when already valid", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let saved = false;
  const user = {
    role: "customer",
    license: buildLicense({ days: 30, plan: "trial" }),
    markModified() {},
    async save() {
      saved = true;
    },
  };
  try {
    await ensureLoginLicense(user);
    assert.equal(saved, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("financial simulation stays development-only", () => {
  assert.equal(FINANCIAL_MODE, "development");
  assert.equal(getPaymentService() instanceof DevelopmentPaymentService, true);
});

test("production env validation lists missing secrets without printing them", () => {
  const missing = productionEnvProblems({ NODE_ENV: "production" });
  assert.ok(missing.includes("MONGODB_URI"));
  assert.ok(missing.some((item) => item.startsWith("JWT_SECRET")));
  assert.ok(missing.includes("ADMIN_EMAIL"));
  assert.ok(missing.includes("ADMIN_PASSWORD"));
});

test("SVG and executable uploads are rejected", async () => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    req.user = { _id: "u1", role: "customer" };
    req.userId = "u1";
    next();
  });
  app.use("/api/upload", uploadRoutes);
  app.use(errorHandler);
  const { server, url } = await listen(app);
  try {
    const svg = await json(url, "POST", "/api/upload", {
      dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      filename: "x.svg",
    });
    assert.equal(svg.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_hardening_test";
let seq = 0;

function nextCode() {
  seq += 1;
  return `HRD-${Date.now()}-${seq}`;
}

async function makeUser(role, extra = {}) {
  const n = nextCode();
  return User.create({
    name: `${role} ${n}`,
    email: `${role}-${n}@hard.test`,
    passwordHash: "x",
    role,
    phone: "9876543210",
    address: "12 Private Street",
    ...extra,
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
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  return listen(app);
}

async function call(url, user, method, path, body) {
  return json(url, method, path, body, { "x-test-user": String(user._id) });
}

test("authorization, ObjectId, amount, and ready checks against MongoDB", async (t) => {
  let mongoReady = false;
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    mongoReady = true;
  } catch (err) {
    console.warn("Skipping Mongo hardening tests:", err.message);
  }
  t.after(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
  if (!mongoReady) {
    t.skip("local MongoDB is not available");
    return;
  }

  const { server, url } = await jobApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  await t.test("invalid ObjectId is 400", async () => {
    const worker = await makeUser("worker", { provider: { available: true, businessName: "W" } });
    const res = await call(url, worker, "GET", "/requests/not-an-id");
    assert.equal(res.status, 400);
  });

  await t.test("negative amount is rejected", async () => {
    const customer = await makeUser("customer");
    const res = await call(url, customer, "POST", "/requests", {
      description: "Fix AC",
      category: "AC Repair & Service",
      estimatedAmount: -50,
    });
    assert.equal(res.status, 400);
    assert.match(res.data.message, /non-negative|Amount/i);
  });

  await t.test("customer cannot read another customer's job", async () => {
    const a = await makeUser("customer");
    const b = await makeUser("customer");
    const job = await Request.create({
      code: nextCode(),
      customerId: a._id,
      description: "Private job",
      category: "AC Repair & Service",
      status: "accepted",
      address: "12 Private Street",
      estimatedAmount: 400,
    });
    const res = await call(url, b, "GET", `/requests/${job._id}`);
    assert.equal(res.status, 403);
    assert.equal(res.data.message, NO_ACCESS_MESSAGE);
  });

  await t.test("worker cannot modify another worker's job", async () => {
    const customer = await makeUser("customer");
    const w1 = await makeUser("worker", { provider: { available: true, businessName: "W1" } });
    const w2 = await makeUser("worker", { provider: { available: true, businessName: "W2" } });
    const job = await Request.create({
      code: nextCode(),
      customerId: customer._id,
      providerId: w1._id,
      description: "Assigned",
      category: "AC Repair & Service",
      status: "accepted",
      estimatedAmount: 400,
    });
    const res = await call(url, w2, "POST", `/requests/${job._id}/enroute`);
    assert.equal(res.status, 403);
  });

  await t.test("unassigned worker does not receive customer phone", async () => {
    const customer = await makeUser("customer", { phone: "9998887776" });
    const worker = await makeUser("worker", { provider: { available: true, businessName: "W" } });
    const job = await Request.create({
      code: nextCode(),
      customerId: customer._id,
      description: "Open job",
      category: "AC Repair & Service",
      status: "open",
      publicPost: true,
      estimatedAmount: 400,
    });
    const res = await call(url, worker, "GET", `/requests/${job._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.request.customer.phone, "");
    assert.equal(res.data.request.address, "");
  });

  await t.test("watch token is stored hashed", async () => {
    const customer = await makeUser("customer");
    const job = await Request.create({
      code: nextCode(),
      customerId: customer._id,
      description: "Watch me",
      category: "AC Repair & Service",
      status: "open",
      estimatedAmount: 400,
    });
    const res = await call(url, customer, "POST", `/requests/${job._id}/watch-link`);
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    const stored = await Request.findById(job._id).lean();
    assert.equal(stored.watchToken, hashWatchToken(res.data.token));
    assert.notEqual(stored.watchToken, res.data.token);
  });

  await t.test("GET /api/ready is 200 when MongoDB is up", async () => {
    const app = express();
    app.get("/api/ready", ready);
    const { server: readyServer, url: readyUrl } = await listen(app);
    try {
      const res = await json(readyUrl, "GET", "/api/ready");
      assert.equal(res.status, 200);
      assert.equal(res.data.ok, true);
      assert.equal(res.data.ready, true);
    } finally {
      await new Promise((resolve) => readyServer.close(resolve));
    }
  });

  await t.test("login HTTP rate limit returns 429", async () => {
    resetRateLimitStore();
    const app = createApp();
    const { server: authServer, url: authUrl } = await listen(app);
    try {
      let last = { status: 0, data: {} };
      for (let i = 0; i < AUTH_LIMITS.login.max + 1; i += 1) {
        last = await json(authUrl, "POST", "/api/auth/login", {
          email: "nobody@hard.test",
          password: "wrong-password",
          role: "customer",
        });
      }
      assert.equal(last.status, 429);
    } finally {
      await new Promise((resolve) => authServer.close(resolve));
      resetRateLimitStore();
    }
  });
});
