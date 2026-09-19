import mongoose from "mongoose";

/**
 * Idempotency ledger for gateway webhooks. The unique index is what makes a
 * replayed delivery a no-op instead of a second credit.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, default: "" },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true, name: "one_webhook_per_event" });
// Gateways stop retrying long before this; keeps the collection bounded.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
