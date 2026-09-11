import mongoose from "mongoose";

const safetyIncidentSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },
    type: {
      type: String,
      enum: ["emergency", "share_location", "call_contact", "support", "report_customer", "pause_job", "other"],
      default: "emergency",
    },
    description: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    status: { type: String, enum: ["open", "reviewing", "resolved"], default: "open", index: true },
  },
  { timestamps: true }
);

export const SafetyIncident = mongoose.model("SafetyIncident", safetyIncidentSchema);
