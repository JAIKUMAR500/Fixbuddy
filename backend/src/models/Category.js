import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    priceFrom: { type: Number, default: 399 },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: "🔧" },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    services: { type: [serviceSchema], default: [] },
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", categorySchema);
