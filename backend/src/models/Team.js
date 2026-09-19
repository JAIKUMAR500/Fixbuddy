import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["owner", "manager", "worker", "lead", "staff"], default: "worker" },
    groupId: { type: String, default: "" },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    invitedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const teamSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
    groups: { type: [groupSchema], default: [] },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true }
);

export const Team = mongoose.model("Team", teamSchema);
