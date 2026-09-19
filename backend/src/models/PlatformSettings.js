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
    /** Demo defaults by provider context. Historical jobs keep applied finance.commissionPercent. */
    commissionRates: {
      type: {
        independent: { type: Number, default: 10 },
        crew: { type: Number, default: 10 },
        businessMarketplace: { type: Number, default: 8 },
        businessManaged: { type: Number, default: 8 },
      },
      default: () => ({ independent: 10, crew: 10, businessMarketplace: 8, businessManaged: 8 }),
    },
    travelCompensationInr: { type: Number, default: 75 },
    festivalName: { type: String, default: "" },
    festivalCity: { type: String, default: "" },
    festivalNote: { type: String, default: "" },
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
