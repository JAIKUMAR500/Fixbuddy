import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    kind: { type: String, enum: ["text", "image", "voice"], default: "text" },
    mediaUrl: { type: String, default: "" },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedForEveryone: { type: Boolean, default: false },
    durationSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
