import { httpError } from "../utils/asyncHandler.js";
import { MemoryRateLimitStore, RedisRateLimitStore } from "./rateLimitStore.js";
import { env } from "../config/env.js";

let store = new MemoryRateLimitStore();

/**
 * Installs a shared store. Called at startup when REDIS_URL is configured so
 * the sliding window holds across clustered API instances.
 */
export function useRedisRateLimitStore(client) {
  if (!client) {
    store = new MemoryRateLimitStore();
    return store;
  }
  store = new RedisRateLimitStore(client, { fallback: new MemoryRateLimitStore() });
  return store;
}

/** Status for /api/ready. Never includes the Redis URL or credentials. */
export async function rateLimitRedisHealth() {
  if (store.kind !== "redis") {
    return { configured: Boolean(env.redisUrl), connected: false };
  }
  if (typeof store.ping === "function") {
    const connected = await store.ping();
    return { configured: true, connected };
  }
  return { configured: true, connected: store.healthy !== false };
}

export function rateLimitStoreKind() {
  return store.kind;
}

export function clientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

export function identKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

/**
 * Sliding-window limiter. Backed by Redis when configured, otherwise in-process.
 */
export function rateLimit({
  windowMs,
  max,
  key = clientKey,
  message = "Too many attempts. Try again later.",
} = {}) {
  return (req, res, next) => {
    if (process.env.E2E === "1") return next();
    const k = typeof key === "function" ? key(req) : String(key);
    const now = Date.now();
    const decide = ({ count, oldest }) => {
      if (count > max) {
        const retrySec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
        res.setHeader("Retry-After", String(retrySec));
        return next(httpError(429, message));
      }
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      next();
    };

    const result = store.hit(k, windowMs, now);
    if (result && typeof result.then === "function") {
      result.then(decide).catch(() => next());
      return;
    }
    decide(result);
  };
}

export function resetRateLimitStore() {
  store.reset();
}

export const AUTH_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  signup: { windowMs: 60 * 60 * 1000, max: env.isProduction ? 5 : 80 },
  forgot: { windowMs: 15 * 60 * 1000, max: 3 },
  forgotIp: { windowMs: 15 * 60 * 1000, max: 8 },
  reset: { windowMs: 15 * 60 * 1000, max: 10 },
  google: { windowMs: 15 * 60 * 1000, max: 20 },
  watch: { windowMs: 15 * 60 * 1000, max: 30 },
  jobOtp: { windowMs: 15 * 60 * 1000, max: 20 },
  adminMutate: { windowMs: 15 * 60 * 1000, max: 40 },
  upload: { windowMs: 15 * 60 * 1000, max: 20 },
  payment: { windowMs: 15 * 60 * 1000, max: 20 },
};
