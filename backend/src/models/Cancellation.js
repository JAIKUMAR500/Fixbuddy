import mongoose from "mongoose";

const cancellationSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, unique: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    reason: { type: String, default: "other" },
    eligible: { type: Boolean, default: false },
    amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "approved", "paid", "not_eligible"], default: "pending" },
    policyVersion: { type: String, default: "default" },
  },
  { timestamps: true }
);

export const Cancellation = mongoose.model("Cancellation", cancellationSchema);
