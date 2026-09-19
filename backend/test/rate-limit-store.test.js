import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { MemoryRateLimitStore, RedisRateLimitStore } from "../src/middleware/rateLimitStore.js";
import {
  rateLimit,
  rateLimitRedisHealth,
  rateLimitStoreKind,
  resetRateLimitStore,
  useRedisRateLimitStore,
} from "../src/middleware/rateLimit.js";
import { redisConnectionOptions } from "../src/config/redis.js";
import { errorHandler } from "../src/middleware/error.js";

/** Minimal ioredis-compatible sorted-set fake. */
class FakeRedis {
  constructor({ failAfter = Infinity } = {}) {
    this.sets = new Map();
    this.calls = 0;
    this.failAfter = failAfter;
  }

  ping() {
    this.calls += 1;
    if (this.calls > this.failAfter) throw new Error("redis down");
    return "PONG";
  }

  multi() {
    const ops = [];
    const chain = {
      zremrangebyscore: (key, min, max) => (ops.push(["zrem", key, min, max]), chain),
      zadd: (key, score, member) => (ops.push(["zadd", key, score, member]), chain),
      zcard: (key) => (ops.push(["zcard", key]), chain),
      zrange: (key, start, stop) => (ops.push(["zrange", key, start, stop]), chain),
      pexpire: (key, ms) => (ops.push(["pexpire", key, ms]), chain),
      exec: async () => {
        this.calls += 1;
        if (this.calls > this.failAfter) throw new Error("redis down");
        return ops.map((op) => [null, this.#run(op)]);
      },
    };
    return chain;
  }

  #run([kind, key, a, b]) {
    const current = this.sets.get(key) || [];
    if (kind === "zrem") {
      this.sets.set(key, current.filter((entry) => entry.score > b));
      return 1;
    }
    if (kind === "zadd") {
      current.push({ score: a, member: b });
      this.sets.set(key, current);
      return 1;
    }
    if (kind === "zcard") return current.length;
    if (kind === "zrange") {
      const sorted = [...current].sort((x, y) => x.score - y.score);
      return sorted.length ? [sorted[0].member, String(sorted[0].score)] : [];
    }
    return 1;
  }
}

test("memory store counts hits inside the sliding window and drops old ones", () => {
  const store = new MemoryRateLimitStore();
  const start = 1_000_000;
  assert.equal(store.hit("k", 1000, start).count, 1);
  assert.equal(store.hit("k", 1000, start + 100).count, 2);
  assert.equal(store.hit("k", 1000, start + 200).count, 3);
  // Past the window the earlier hits no longer count.
  assert.equal(store.hit("k", 1000, start + 5000).count, 1);
  assert.equal(store.kind, "memory");
});

test("memory store keeps separate keys independent", () => {
  const store = new MemoryRateLimitStore();
  assert.equal(store.hit("a", 1000).count, 1);
  assert.equal(store.hit("b", 1000).count, 1);
  assert.equal(store.hit("a", 1000).count, 2);
  store.reset();
  assert.equal(store.hit("a", 1000).count, 1);
});

test("redis store shares one window across instances", async () => {
  const redis = new FakeRedis();
  const instanceA = new RedisRateLimitStore(redis);
  const instanceB = new RedisRateLimitStore(redis);

  assert.equal((await instanceA.hit("user1", 60_000)).count, 1);
  // A second API instance sees the first instance's hit.
  assert.equal((await instanceB.hit("user1", 60_000)).count, 2);
  assert.equal((await instanceA.hit("user1", 60_000)).count, 3);
  // A different key is unaffected.
  assert.equal((await instanceB.hit("user2", 60_000)).count, 1);
  assert.equal(instanceA.kind, "redis");
});

test("redis store degrades to the in-process window instead of failing requests", async () => {
  const redis = new FakeRedis({ failAfter: 1 });
  const fallback = new MemoryRateLimitStore();
  const store = new RedisRateLimitStore(redis, { fallback });

  assert.equal((await store.hit("k", 60_000)).count, 1);
  assert.equal(store.healthy, true);

  const degraded = await store.hit("k", 60_000);
  assert.equal(degraded.count, 1, "fallback starts its own window");
  assert.equal(store.healthy, false);

  // Once degraded it keeps serving from memory without further Redis calls.
  assert.equal((await store.hit("k", 60_000)).count, 2);
  assert.equal(redis.calls, 2);
});

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("the limiter enforces the same cap through the Redis store", async () => {
  resetRateLimitStore();
  const redis = new FakeRedis();
  useRedisRateLimitStore(redis);
  assert.equal(rateLimitStoreKind(), "redis");

  const app = express();
  app.use(express.json());
  app.post("/thing", rateLimit({ windowMs: 60_000, max: 3, key: () => "shared", message: "slow down" }), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  const { server, url } = await listen(app);

  try {
    const post = () => fetch(`${url}/thing`, { method: "POST" });
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    const third = await post();
    assert.equal(third.status, 200);
    assert.equal(third.headers.get("x-ratelimit-remaining"), "0");

    const blocked = await post();
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.match((await blocked.json()).message, /slow down/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    useRedisRateLimitStore(null);
    resetRateLimitStore();
    assert.equal(rateLimitStoreKind(), "memory");
  }
});

test("REDIS_URL parsing accepts redis and rediss and rejects junk", () => {
  assert.equal(redisConnectionOptions(""), null);
  assert.equal(redisConnectionOptions(undefined), null);
  assert.equal(redisConnectionOptions("not-a-url"), null);
  assert.equal(redisConnectionOptions("mongodb://localhost:27017"), null);

  const plain = redisConnectionOptions("redis://localhost:6379");
  assert.ok(plain);
  assert.equal(plain.url, "redis://localhost:6379");
  assert.equal(plain.tls, undefined);

  const tls = redisConnectionOptions("rediss://:demo-password@example.com:6380");
  assert.ok(tls);
  assert.ok(tls.tls);
  assert.equal(tls.tls.rejectUnauthorized, true);
  assert.equal(tls.maxRetriesPerRequest, 2);
});

test("redis store retries the shared instance after the cooldown", async () => {
  const redis = new FakeRedis({ failAfter: 1 });
  const store = new RedisRateLimitStore(redis, { retryAfterMs: 40 });

  assert.equal((await store.hit("k", 60_000)).count, 1);
  const degraded = await store.hit("k", 60_000);
  assert.equal(degraded.count, 1);
  assert.equal(store.healthy, false);

  await new Promise((resolve) => setTimeout(resolve, 50));
  redis.failAfter = Infinity;
  const recovered = await store.hit("k", 60_000);
  assert.equal(store.healthy, true);
  assert.ok(recovered.count >= 1);
});

test("rate-limit health reports configured Redis without exposing the URL", async () => {
  useRedisRateLimitStore(null);
  const off = await rateLimitRedisHealth();
  assert.equal(off.connected, false);

  const redis = new FakeRedis();
  useRedisRateLimitStore(redis);
  const up = await rateLimitRedisHealth();
  assert.equal(up.configured, true);
  assert.equal(up.connected, true);

  useRedisRateLimitStore(null);
  resetRateLimitStore();
});
