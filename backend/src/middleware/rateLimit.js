import { httpError } from "../utils/asyncHandler.js";

const buckets = new Map();

function prune(now, windowMs, hits) {
  return hits.filter((t) => now - t < windowMs);
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
 * In-memory limiter (one Render instance). Multi-instance production should
 * replace this with a shared store such as Redis.
 */
export function rateLimit({
  windowMs,
  max,
  key = clientKey,
  message = "Too many attempts. Try again later.",
} = {}) {
  return (req, res, next) => {
    const k = typeof key === "function" ? key(req) : String(key);
    const now = Date.now();
    let hits = prune(now, windowMs, buckets.get(k) || []);
    if (hits.length >= max) {
      const retrySec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return next(httpError(429, message));
    }
    hits.push(now);
    buckets.set(k, hits);
    if (buckets.size > 20000) {
      for (const [oldKey, oldHits] of buckets) {
        const kept = prune(now, windowMs, oldHits);
        if (!kept.length) buckets.delete(oldKey);
        else buckets.set(oldKey, kept);
      }
    }
    next();
  };
}

export function resetRateLimitStore() {
  buckets.clear();
}

export const AUTH_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  signup: { windowMs: 60 * 60 * 1000, max: 5 },
  forgot: { windowMs: 15 * 60 * 1000, max: 3 },
  forgotIp: { windowMs: 15 * 60 * 1000, max: 8 },
  reset: { windowMs: 15 * 60 * 1000, max: 10 },
  google: { windowMs: 15 * 60 * 1000, max: 20 },
  watch: { windowMs: 15 * 60 * 1000, max: 30 },
  jobOtp: { windowMs: 15 * 60 * 1000, max: 20 },
  adminMutate: { windowMs: 15 * 60 * 1000, max: 40 },
};
