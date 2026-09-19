import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromRole: { type: String, enum: ["customer", "worker"], default: "customer" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

reviewSchema.index({ requestId: 1, authorId: 1 }, { unique: true });

reviewSchema.pre("validate", function setAuthor() {
  if (!this.authorId && this.customerId) this.authorId = this.customerId;
});

export const Review = mongoose.model("Review", reviewSchema);
