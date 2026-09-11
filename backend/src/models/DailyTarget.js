import mongoose from "mongoose";

const dailyTargetSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 100, max: 100000 },
  },
  { timestamps: true }
);

dailyTargetSchema.index({ workerId: 1, date: 1 }, { unique: true });

export const DailyTarget = mongoose.model("DailyTarget", dailyTargetSchema);
