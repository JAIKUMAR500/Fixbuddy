import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const adminPassword = process.env.ADMIN_PASSWORD || "";

if (isProduction && (!process.env.JWT_SECRET || jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET must be a strong 32+ character secret in production");
}

if (isProduction && (!process.env.ADMIN_EMAIL || !adminPassword)) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured in production");
}

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/fixbuddy",
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || "15m",
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
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword,
};
