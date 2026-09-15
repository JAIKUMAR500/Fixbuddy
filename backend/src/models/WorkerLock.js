import mongoose from "mongoose";

const workerLockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
  },
  { timestamps: true }
);

export const WorkerLock = mongoose.model("WorkerLock", workerLockSchema);
