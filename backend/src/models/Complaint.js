import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    againstId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },
    party: { type: String, enum: ["customer", "provider", "worker", "business"], default: "customer" },
    subject: { type: String, required: true },
    reason: {
      type: String,
      enum: ["work_not_completed", "damage", "wrong_amount", "worker_issue", "customer_issue", "other"],
      default: "other",
    },
    body: { type: String, default: "" },
    photos: { type: [String], default: [] },
    status: { type: String, enum: ["open", "investigating", "resolved"], default: "open", index: true },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
