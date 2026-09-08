import mongoose from "mongoose";

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
    platformName: { type: String, default: "FixBuddy" },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model("PlatformSettings", settingsSchema);

export async function getSettings() {
  let doc = await PlatformSettings.findOne({ key: "default" });
  if (!doc) doc = await PlatformSettings.create({ key: "default" });
  return doc;
}
