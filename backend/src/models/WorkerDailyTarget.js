import mongoose from "mongoose";

const workerDailyTargetSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    amount: { type: Number, min: 0, default: 1500 },
    targetDate: { type: String, required: true },
  },
  { timestamps: true }
);

export const WorkerDailyTarget = mongoose.model("WorkerDailyTarget", workerDailyTargetSchema);
