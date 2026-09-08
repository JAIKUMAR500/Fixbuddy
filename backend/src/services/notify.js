import { Notification } from "../models/Notification.js";

export async function notify(userId, { type = "info", text, requestId = null }) {
  if (!userId) return null;
  return Notification.create({ userId, type, text, requestId });
}

export async function notifyMany(userIds, payload) {
  const docs = userIds.filter(Boolean).map((userId) => ({ userId, ...payload }));
  if (!docs.length) return;
  await Notification.insertMany(docs);
}
