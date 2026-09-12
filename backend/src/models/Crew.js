import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["leader", "member"], default: "member" },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    sharePercent: { type: Number, default: 0 },
  },
  { _id: true }
);

const crewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    skills: { type: [String], default: [] },
    serviceArea: { type: String, default: "" },
    maxMembers: { type: Number, default: 6, min: 2, max: 20 },
    leaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [memberSchema], default: [] },
    splitMode: { type: String, enum: ["equal", "role", "custom"], default: "equal" },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    completedJobs: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

crewSchema.index({ "members.userId": 1, status: 1 });

export const Crew = mongoose.model("Crew", crewSchema);
