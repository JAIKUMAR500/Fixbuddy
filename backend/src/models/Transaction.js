import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },
    fromId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    toId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    amount: { type: Number, required: true },
    kind: { type: String, enum: ["payment", "payout", "refund", "commission"], default: "payment" },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "paid", index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
