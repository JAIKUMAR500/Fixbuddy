import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

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

function assertNoRealPayments() {
  const mode = String(process.env.FINANCIAL_MODE || "development").toLowerCase();
  if (mode && mode !== "development") {
    throw new Error("FINANCIAL_MODE must remain development. Real payments are not enabled in this release.");
  }
  const forbidden = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_SECRET",
    "PAYU_MERCHANT_KEY",
    "PAYU_SALT",
  ];
  if (forbidden.some((name) => process.env[name])) {
    throw new Error("Payment gateway variables are set, but this release has no payment gateway. Unset them before starting.");
  }
}

assertNoRealPayments();
if (isProduction) assertProductionEnv();

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const adminPassword = process.env.ADMIN_PASSWORD || "";

export const env = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/fixbuddy",
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || "7d",
  clientOrigin:
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173,http://localhost:8443,https://fixbuddy-ivory.vercel.app",
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
  financialMode: "development",
};

export function logStartupConfig() {
  const mongoKind = /localhost|127\.0\.0\.1/.test(env.mongoUri) ? "local" : "configured";
  console.log(
    `FixBuddy config env=${process.env.NODE_ENV || "development"} port=${env.port} mongo=${mongoKind} jwt=set smtp=${env.smtpPass ? "configured" : "off"} financialMode=development`,
  );
}
