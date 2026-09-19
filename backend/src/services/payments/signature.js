import crypto from "node:crypto";
import { GATEWAYS } from "./gatewayConfig.js";

/** Constant-time compare so a wrong signature cannot be probed byte by byte. */
export function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function razorpaySignature(rawBody, secret) {
  return crypto.createHmac("sha256", String(secret)).update(rawBody).digest("hex");
}

/** Stripe signs `<timestamp>.<body>` and sends `t=...,v1=...`. */
export function stripeSignature(rawBody, secret, timestamp) {
  return crypto.createHmac("sha256", String(secret)).update(`${timestamp}.${rawBody}`).digest("hex");
}

function parseStripeHeader(header) {
  const parts = String(header || "")
    .split(",")
    .map((chunk) => chunk.trim().split("="));
  const out = { t: "", v1: [] };
  for (const [key, value] of parts) {
    if (key === "t") out.t = value;
    if (key === "v1" && value) out.v1.push(value);
  }
  return out;
}

/**
 * Verifies a webhook against the raw request body.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyWebhookSignature({ provider, rawBody, headers = {}, secret, toleranceSec = 300, nowSec }) {
  if (!secret) return { ok: false, reason: "Webhook secret is not configured." };
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  if (!body) return { ok: false, reason: "Empty webhook body." };

  if (provider === GATEWAYS.RAZORPAY) {
    const header = headers["x-razorpay-signature"] || headers["X-Razorpay-Signature"];
    if (!header) return { ok: false, reason: "Missing signature header." };
    return safeEqual(header, razorpaySignature(body, secret))
      ? { ok: true }
      : { ok: false, reason: "Signature mismatch." };
  }

  if (provider === GATEWAYS.STRIPE) {
    const header = headers["stripe-signature"] || headers["Stripe-Signature"];
    if (!header) return { ok: false, reason: "Missing signature header." };
    const { t, v1 } = parseStripeHeader(header);
    if (!t || !v1.length) return { ok: false, reason: "Malformed signature header." };
    const current = Number.isFinite(nowSec) ? nowSec : Math.floor(Date.now() / 1000);
    if (Math.abs(current - Number(t)) > toleranceSec) {
      return { ok: false, reason: "Webhook timestamp is outside the allowed window." };
    }
    const expected = stripeSignature(body, secret, t);
    return v1.some((candidate) => safeEqual(candidate, expected))
      ? { ok: true }
      : { ok: false, reason: "Signature mismatch." };
  }

  return { ok: false, reason: "Unsupported payment provider." };
}

/** Razorpay's separate client-side handshake for checkout success callbacks. */
export function verifyRazorpayCheckout({ orderId, paymentId, signature, secret }) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", String(secret))
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(signature, expected);
}
