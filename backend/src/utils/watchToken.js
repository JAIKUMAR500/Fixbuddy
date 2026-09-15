import crypto from "node:crypto";

const WATCH_TTL_MS = 2 * 60 * 60 * 1000;

export function watchTtlMs() {
  return WATCH_TTL_MS;
}

export function createWatchToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashWatchToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function watchExpiresAt(from = Date.now()) {
  return new Date(from + WATCH_TTL_MS);
}
