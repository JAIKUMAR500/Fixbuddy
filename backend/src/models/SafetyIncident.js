import mongoose from "mongoose";

const safetyIncidentSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null, index: true },
    type: { type: String, enum: ["emergency", "unsafe_location", "customer_report", "worker_report", "other"], default: "emergency" },
    description: { type: String, default: "", maxlength: 1000 },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    status: { type: String, enum: ["open", "reviewing", "resolved"], default: "open", index: true },
  },
  { timestamps: true }
);

export const SafetyIncident = mongoose.model("SafetyIncident", safetyIncidentSchema);
