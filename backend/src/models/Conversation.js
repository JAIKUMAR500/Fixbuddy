import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, unique: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastMessage: { type: String, default: "" },
    lastAt: { type: Date, default: Date.now },
    unreadCustomer: { type: Number, default: 0 },
    unreadProvider: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ customerId: 1, lastAt: -1 });
conversationSchema.index({ providerId: 1, lastAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
