import mongoose from "mongoose";

const cancellationRecordSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledBy: { type: String, enum: ["customer", "worker", "business", "admin"], required: true },
    reason: { type: String, default: "" },
    statusWas: { type: String, default: "" },
    compensation: { type: Number, default: 0 },
    eligible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CancellationRecord = mongoose.model("CancellationRecord", cancellationRecordSchema);
