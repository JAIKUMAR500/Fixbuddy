import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    distance: { type: String, default: "" },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    postedByRole: { type: String, enum: ["customer", "business", "admin"], default: "customer", index: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    address: { type: String, default: "" },
    area: { type: String, default: "" },
    city: { type: String, default: "Bengaluru" },
    landmark: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    photos: { type: [String], default: [] },
    voiceNote: { type: String, default: "" },
    timing: { type: String, default: "asap" },
    scheduledAt: { type: Date, default: null },
    scheduledLabel: { type: String, default: "" },
    budgetMin: { type: Number, default: 300 },
    budgetMax: { type: Number, default: 800 },
    estimatedAmount: { type: Number, default: 0 },
    workerQuote: { type: Number, default: null },
    tags: { type: [String], default: [] },
    publicPost: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "matching",
        "open",
        "requested",
        "accepted",
        "scheduled",
        "in_progress",
        "completed",
        "reviewed",
        "cancelled",
        "declined",
      ],
      default: "matching",
      index: true,
    },
    timeline: { type: [timelineSchema], default: [] },
    matches: { type: [matchSchema], default: [] },
    declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

requestSchema.index({ status: 1, category: 1, city: 1, createdAt: -1 });
requestSchema.index({ customerId: 1, createdAt: -1 });
requestSchema.index({ providerId: 1, status: 1, createdAt: -1 });

export const Request = mongoose.model("Request", requestSchema);
