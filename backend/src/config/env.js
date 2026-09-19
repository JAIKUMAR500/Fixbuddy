import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { assertPaymentEnv, isGatewayReady, resolvedFinancialMode } from "../services/payments/gatewayConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isProduction = process.env.NODE_ENV === "production";

export function productionEnvProblems(source = process.env) {
  const missing = [];
  if (!source.MONGODB_URI) missing.push("MONGODB_URI");
  if (!source.JWT_SECRET || source.JWT_SECRET.length < 32) missing.push("JWT_SECRET (32+ characters)");
  if (!source.ADMIN_EMAIL) missing.push("ADMIN_EMAIL");
  if (!source.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  return missing;
}

function assertProductionEnv() {
  const missing = productionEnvProblems();
  if (missing.length) {
    throw new Error(`Production startup blocked. Missing or invalid: ${missing.join(", ")}`);
  }
}

assertPaymentEnv();
if (isProduction) assertProductionEnv();

export function durationMs(value, fallbackMs) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (mult[unit] || 1);
}

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const adminPassword = process.env.ADMIN_PASSWORD || "";
const jwtAccessExpires = process.env.JWT_ACCESS_EXPIRES || "15m";
const jwtRefreshExpires = process.env.JWT_REFRESH_EXPIRES || process.env.JWT_EXPIRES || "7d";

export const env = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/fixbuddy",
  jwtSecret,
  jwtExpires: jwtRefreshExpires,
  jwtAccessExpires,
  jwtAccessMs: durationMs(jwtAccessExpires, 15 * 60_000),
  jwtRefreshMs: durationMs(jwtRefreshExpires, 7 * 86_400_000),
  clientOrigin:
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173,http://localhost:8443,https://fixbuddy-ivory.vercel.app,https://localhost,capacitor://localhost",
  publicUrl: process.env.API_PUBLIC_URL || "",
  supportEmail: process.env.SUPPORT_EMAIL || "jaikuma500500@gmail.com",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || process.env.SUPPORT_EMAIL || "jaikuma500500@gmail.com",
  smtpPass: process.env.SMTP_PASS || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || "",
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword,
  /** "production" only when a gateway is fully configured; otherwise simulated. */
  financialMode: isGatewayReady() ? "production" : "development",
  requestedFinancialMode: resolvedFinancialMode(),
  redisUrl: process.env.REDIS_URL || "",
};

export function logStartupConfig({ rateLimitStore } = {}) {
  const mongoKind = /localhost|127\.0\.0\.1/.test(env.mongoUri) ? "local" : "configured";
  const store = rateLimitStore || (env.redisUrl ? "redis-configured" : "in-process");
  console.log(
    `FixBuddy config env=${process.env.NODE_ENV || "development"} port=${env.port} mongo=${mongoKind} jwt=set smtp=${env.smtpPass ? "configured" : "off"} financialMode=${env.financialMode} storage=${process.env.S3_BUCKET ? "s3" : "local-disk"} rateLimitStore=${store}`,
  );
}
