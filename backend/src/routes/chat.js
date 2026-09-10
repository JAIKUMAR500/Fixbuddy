import { Router } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { notify } from "../services/notify.js";
import { ensureConversation } from "../services/chat.js";
import { asyncHandler, httpError, timeAgo } from "../utils/asyncHandler.js";
import { isFulfiller } from "../utils/roles.js";

const router = Router();

router.post(
  "/open",
  asyncHandler(async (req, res) => {
    const requestId = req.body.requestId;
    if (!requestId) throw httpError(400, "requestId is required");
    const doc = await Request.findById(requestId);
    if (!doc) throw httpError(404, "Request not found");
    const isCustomer = String(doc.customerId) === req.userId;
    const isAssignedWorker = Boolean(doc.providerId) && String(doc.providerId) === req.userId;
    const mine = isCustomer || isAssignedWorker || req.user.role === "admin";
    if (!mine) {
      if (isFulfiller(req.user.role)) throw httpError(403, "Accept the job first to message the customer.");
      throw httpError(403, "Not your job");
    }
    let conversationRequest = doc;
    if (!doc.providerId) {
      const selectedProviderId = String(req.body.providerId || "");
      if (!selectedProviderId) throw httpError(400, "Chat opens after a worker accepts this job");
      if (!isCustomer && req.user.role !== "admin") throw httpError(403, "Not your job");
      const selectedProvider = await User.findOne({ _id: selectedProviderId, role: "worker", status: "active" }).select("_id").lean();
      if (!selectedProvider) throw httpError(400, "This worker is not available for messaging");
      conversationRequest = { ...doc.toObject(), providerId: selectedProvider._id };
    }
    const conv = await ensureConversation(conversationRequest);
    if (!conv) throw httpError(400, "Could not start chat");
    res.json({ conversationId: String(conv._id), requestId: String(doc._id) });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const asFulfiller = isFulfiller(req.user.role);
    const filter = asFulfiller ? { providerId: req.userId } : { customerId: req.userId };
    const rows = await Conversation.find(filter).sort({ lastAt: -1 }).limit(50).lean();
    const userIds = rows.map((c) => (asFulfiller ? c.customerId : c.providerId));
    const reqIds = rows.map((c) => c.requestId);
    const [users, requests] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("name avatar phone provider").lean(),
      Request.find({ _id: { $in: reqIds } }).select("category code status").lean(),
    ]);
    const umap = Object.fromEntries(users.map((u) => [String(u._id), u]));
    const rmap = Object.fromEntries(requests.map((r) => [String(r._id), r]));
    res.json({
      conversations: rows.map((c) => {
        const otherId = asFulfiller ? String(c.customerId) : String(c.providerId);
        const other = umap[otherId];
        const job = rmap[String(c.requestId)];
        return {
          id: String(c._id),
          requestId: String(c.requestId),
          name: other?.provider?.businessName || other?.name || "User",
          avatar: other?.avatar || "",
          phone: other?.phone || "",
          lastMessage: c.lastMessage,
          time: timeAgo(c.lastAt),
          unread: asFulfiller ? c.unreadProvider : c.unreadCustomer,
          service: job?.category || "",
          status: job?.status || "",
        };
      }),
    });
  })
);

router.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw httpError(404, "Conversation not found");
    const mine = String(conv.customerId) === req.userId || String(conv.providerId) === req.userId;
    if (!mine && req.user.role !== "admin") throw httpError(403, "Not allowed");
    const msgs = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(200).lean();
    if (String(conv.customerId) === req.userId) conv.unreadCustomer = 0;
    if (String(conv.providerId) === req.userId) conv.unreadProvider = 0;
    await conv.save();
    res.json({
      conversationId: String(conv._id),
      requestId: String(conv.requestId),
      messages: msgs.map((m) => ({
        id: String(m._id),
        senderId: String(m.senderId),
        sender: String(m.senderId) === String(conv.customerId) ? "customer" : "provider",
        text: m.text,
        kind: m.kind || "text",
        mediaUrl: m.mediaUrl || "",
        time: new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
      })),
    });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw httpError(404, "Conversation not found");
    const mine = String(conv.customerId) === req.userId || String(conv.providerId) === req.userId;
    if (!mine) throw httpError(403, "Not allowed");
    const text = String(req.body.text || "").trim();
    const kind = ["image", "voice"].includes(req.body.kind) ? req.body.kind : "text";
    const mediaUrl = String(req.body.mediaUrl || "");
    if (!text && !mediaUrl) throw httpError(400, "Message text or media is required");
    const msg = await Message.create({
      conversationId: conv._id,
      senderId: req.userId,
      text: text || (kind === "voice" ? "Voice note" : kind === "image" ? "Photo" : ""),
      kind,
      mediaUrl,
    });
    conv.lastMessage = msg.text;
    conv.lastAt = new Date();
    if (String(conv.customerId) === req.userId) conv.unreadProvider += 1;
    else conv.unreadCustomer += 1;
    await conv.save();
    const other = String(conv.customerId) === req.userId ? conv.providerId : conv.customerId;
    await notify(other, { type: "message", text: `${req.user.name} sent you a message`, requestId: conv.requestId });
    res.status(201).json({
      message: {
        id: String(msg._id),
        senderId: req.userId,
        sender: String(conv.customerId) === req.userId ? "customer" : "provider",
        text: msg.text,
        kind: msg.kind,
        mediaUrl: msg.mediaUrl,
        time: new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
      },
    });
  })
);

export default router;
