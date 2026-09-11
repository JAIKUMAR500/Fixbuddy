import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["assigned", "accepted", "declined", "arrived", "completed"], default: "assigned" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { _id: false }
);

const teamJobSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, unique: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["requested", "accepted", "in_progress", "completed", "cancelled"], default: "requested", index: true },
    assignments: { type: [assignmentSchema], default: [] },
    timeline: { type: [{ status: String, note: String, at: { type: Date, default: Date.now } }], default: [] },
  },
  { timestamps: true }
);

export const TeamJob = mongoose.model("TeamJob", teamJobSchema);
