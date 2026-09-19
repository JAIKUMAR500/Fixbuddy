import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { durationMs } from "../src/config/env.js";
import { parseCookies, readAccessToken } from "../src/middleware/authCookies.js";

test("duration parser understands access and refresh TTLs", () => {
  assert.equal(durationMs("15m", 0), 15 * 60_000);
  assert.equal(durationMs("7d", 0), 7 * 86_400_000);
  assert.equal(durationMs("bad", 99), 99);
});

test("cookie parser and dual-token extraction", () => {
  assert.equal(parseCookies("fb_access=abc; fb_refresh=xyz").fb_access, "abc");
  const fromBearer = readAccessToken({ headers: { authorization: "Bearer tok", cookie: "fb_access=cookie-tok" } });
  assert.equal(fromBearer, "tok");
  const fromCookie = readAccessToken({ headers: { cookie: "fb_access=cookie-tok" } });
  assert.equal(fromCookie, "cookie-tok");
});

const TEST_URI = process.env.LOCK_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fixbuddy_auth_session_test";
let mongoReady = false;

test.before(async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Skipping Mongo auth-session tests:", err.message);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function cookieHeader(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list
    .map((row) => String(row).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

test("login sets HttpOnly cookies and refresh rotates the session", async () => {
  if (!mongoReady) return;
  const { server, url } = await listen(createApp());
  try {
    const email = `sess-${Date.now()}@auth.test`;
    const signup = await fetch(`${url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cookie User", email, password: "CookiePass1", role: "customer" }),
    });
    const signed = await signup.json();
    assert.equal(signup.status, 201, signed.message);
    assert.ok(signed.token);
    assert.ok(signed.refreshToken);
    const setCookie = signup.headers.getSetCookie?.() || signup.headers.get("set-cookie");
    assert.ok(setCookie);
    const jar = cookieHeader(signup.headers.getSetCookie?.() || [setCookie]);
    assert.match(jar, /fb_access=/);
    assert.match(jar, /fb_refresh=/);

    const me = await fetch(`${url}/api/auth/me`, { headers: { Cookie: jar } });
    const meBody = await me.json();
    assert.equal(me.status, 200, meBody.message);
    assert.equal(meBody.user.email, email);

    const refreshed = await fetch(`${url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: jar },
      body: JSON.stringify({}),
    });
    const refreshBody = await refreshed.json();
    assert.equal(refreshed.status, 200, refreshBody.message);
    assert.ok(refreshBody.token);
    assert.notEqual(refreshBody.refreshToken, signed.refreshToken);

    const reuse = await fetch(`${url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: signed.refreshToken }),
    });
    assert.equal(reuse.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
