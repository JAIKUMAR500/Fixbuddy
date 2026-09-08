import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "info" },
    text: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
