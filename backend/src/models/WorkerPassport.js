import mongoose from "mongoose";

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: String, enum: ["beginner", "experienced", "expert"], default: "experienced" },
    verified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ["unverified", "pending", "verified", "rejected"], default: "unverified" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    verificationNote: { type: String, default: "" },
    verificationRequestedAt: { type: Date, default: null },
  },
  { _id: true }
);

const workerPassportSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    bio: { type: String, default: "", maxlength: 800 },
    experienceYears: { type: Number, min: 0, max: 80, default: 0 },
    languages: { type: [String], default: [] },
    serviceAreas: { type: [String], default: [] },
    skills: { type: [skillSchema], default: [] },
  },
  { timestamps: true }
);

export const WorkerPassport = mongoose.model("WorkerPassport", workerPassportSchema);
