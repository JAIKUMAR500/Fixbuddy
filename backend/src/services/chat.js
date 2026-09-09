import { Conversation } from "../models/Conversation.js";

export async function ensureConversation(request) {
  if (!request.providerId || !request.customerId) return null;
  return Conversation.findOneAndUpdate(
    { requestId: request._id, providerId: request.providerId },
    {
      $setOnInsert: {
        requestId: request._id,
        customerId: request.customerId,
        providerId: request.providerId,
        lastMessage: "Conversation started",
        lastAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}
