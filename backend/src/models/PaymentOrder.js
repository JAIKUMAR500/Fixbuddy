import mongoose from "mongoose";

/**
 * Server-side record of a checkout attempt. The amount here is authoritative:
 * webhooks are matched against it so a client can never dictate what was paid.
 */
const paymentOrderSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    provider: { type: String, required: true },
    orderId: { type: String, required: true, unique: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "expired"],
      default: "created",
      index: true,
    },
    gatewayPaymentId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

/** One open order per job keeps checkout retries from multiplying orders. */
paymentOrderSchema.index(
  { requestId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "created" }, name: "one_open_order_per_job" }
);

export const PaymentOrder = mongoose.model("PaymentOrder", paymentOrderSchema);
