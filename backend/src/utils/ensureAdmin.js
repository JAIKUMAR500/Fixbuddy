import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { getSettings } from "../models/PlatformSettings.js";
import { env } from "../config/env.js";
import { buildLicense, repairUserCodes, createUserWithCode } from "./license.js";

const DEMO_EMAILS = ["customer@fixbuddy.com", "worker@fixbuddy.com", "provider@fixbuddy.com"];

export async function ensureProductionAccounts() {
  await User.deleteMany({ email: { $in: DEMO_EMAILS } });

  const settings = await getSettings();
  let settingsDirty = false;
  if (settings.supportEmail === "support@fixbuddy.com" || !settings.supportEmail) {
    settings.supportEmail = env.supportEmail;
    settingsDirty = true;
  }
  if (!settings.smtpHost) {
    settings.smtpHost = env.smtpHost;
    settingsDirty = true;
  }
  if (!settings.smtpPort) {
    settings.smtpPort = env.smtpPort;
    settingsDirty = true;
  }
  if (!settings.smtpUser) {
    settings.smtpUser = env.smtpUser;
    settingsDirty = true;
  }
  if (!settings.smtpPass && env.smtpPass) {
    settings.smtpPass = env.smtpPass;
    settingsDirty = true;
  }
  if (settingsDirty) await settings.save();
  await repairUserCodes();

  const adminEmail = env.adminEmail;
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  const existing = await User.findOne({ email: adminEmail }).select("+passwordHash");
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = "admin";
    existing.status = "active";
    existing.profileAsked = true;
    existing.license = buildLicense({ days: 3650, plan: "admin" });
    existing.markModified("passwordHash");
    await existing.save();
    console.log(`Super Admin ready: ${adminEmail}`);
    return;
  }
  await createUserWithCode({
    name: "FixBuddy Admin",
    email: adminEmail,
    phone: "",
    passwordHash,
    role: "admin",
    status: "active",
    license: buildLicense({ days: 3650, plan: "admin" }),
    profileAsked: true,
  });
  console.log(`Super Admin created: ${adminEmail}`);
}
