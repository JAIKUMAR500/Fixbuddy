import mongoose from "mongoose";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    allowRegistrations: { type: Boolean, default: true },
    autoApproveProviders: { type: Boolean, default: false },
    supportEmail: { type: String, default: "jaikuma500500@gmail.com" },
    googleClientId: { type: String, default: "" },
    smtpHost: { type: String, default: "smtp.gmail.com" },
    smtpPort: { type: Number, default: 465 },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "" },
    commissionPercent: { type: Number, default: 10 },
    cancellationPolicy: {
      version: { type: String, default: "v1" },
      workerTravelCompensation: { type: Number, default: 75, min: 0 },
      workerTravelAfterMinutes: { type: Number, default: 5, min: 0 },
      customerCancelAfterAccept: { type: Boolean, default: true },
    },
    platformName: { type: String, default: "FixBuddy" },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model("PlatformSettings", settingsSchema);

export async function getSettings() {
  const hit = cacheGet("settings:default");
  if (hit) return hit;
  let doc = await PlatformSettings.findOne({ key: "default" });
  if (!doc) doc = await PlatformSettings.create({ key: "default" });
  cacheSet("settings:default", doc, 60_000);
  return doc;
}

export function clearSettingsCache() {
  cacheDel("settings:default");
  cacheDel("public:config");
}
