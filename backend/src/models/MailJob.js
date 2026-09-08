import mongoose from "mongoose";

const mailJobSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, lowercase: true, index: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    kind: { type: String, default: "otp", index: true },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    scheduledAt: { type: Date, default: Date.now, index: true },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

mailJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const MailJob = mongoose.model("MailJob", mailJobSchema);
