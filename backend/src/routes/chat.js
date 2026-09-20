import { Router } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { notify } from "../services/notify.js";
import { ensureConversation } from "../services/chat.js";
import { asyncHandler, httpError, timeAgo } from "../utils/asyncHandler.js";
import { isFulfiller } from "../utils/roles.js";
import { paramObjectId, isValidObjectId } from "../middleware/validate.js";
import { isOnline } from "../utils/geo.js";
import { emitChatMessage } from "../realtime/io.js";

const router = Router();

router.param("id", paramObjectId("id"));
router.param("messageId", paramObjectId("messageId"));

router.post(
  "/open",
  asyncHandler(async (req, res) => {
    const requestId = req.body.requestId;
    if (!requestId) throw httpError(400, "requestId is required");
    if (!isValidObjectId(requestId)) throw httpError(400, "Invalid ID");
    const doc = await Request.findById(requestId);
    if (!doc) throw httpError(404, "Request not found");
    const ACCEPTED_CHAT_STATUSES = [
      "accepted",
      "scheduled",
      "on_the_way",
      "arrived",
      "otp_verified",
      "in_progress",
      "completed",
      "payment_collected",
      "customer_completed",
      "reviewed",
    ];
    if (!doc.providerId || !ACCEPTED_CHAT_STATUSES.includes(doc.status)) {
      throw httpError(403, "Chat is only available after a worker accepts the job.");
    }
    const isCustomer = String(doc.customerId) === req.userId;
    const isAssignedWorker = String(doc.providerId) === req.userId;
    const isCrewHelper = (doc.crewMemberIds || []).some((id) => String(id) === req.userId);
    const mine = isCustomer || isAssignedWorker || isCrewHelper || req.user.role === "admin";
    if (!mine) {
      if (isFulfiller(req.user.role)) throw httpError(403, "Accept the job first to message the customer.");
      throw httpError(403, "Not your job");
    }
    const conv = await ensureConversation(doc);
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
      User.find({ _id: { $in: userIds } }).select("name avatar phone provider lastSeenAt").lean(),
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
          online: isOnline(other?.lastSeenAt),
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
      const msgs = await Message.find({
        conversationId: conv._id,
        deletedFor: { $ne: req.userId },
      })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
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
        text: m.deletedForEveryone ? "This message was deleted" : m.text,
        kind: m.deletedForEveryone ? "text" : m.kind || "text",
        mediaUrl: m.deletedForEveryone ? "" : m.mediaUrl || "",
        deleted: !!m.deletedForEveryone,
        durationSec: m.durationSec || 0,
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
    const durationSec = Number(req.body.durationSec || 0);
    if (!text && !mediaUrl) throw httpError(400, "Message text or media is required");
    const msg = await Message.create({
      conversationId: conv._id,
      senderId: req.userId,
      text: text || (kind === "voice" ? "Voice note" : kind === "image" ? "Photo" : ""),
      kind,
      mediaUrl,
      durationSec,
    });
    conv.lastMessage = msg.text;
    conv.lastAt = new Date();
    if (String(conv.customerId) === req.userId) conv.unreadProvider += 1;
    else conv.unreadCustomer += 1;
    await conv.save();
    const other = String(conv.customerId) === req.userId ? conv.providerId : conv.customerId;
    await notify(other, { type: "message", text: `${req.user.name} sent you a message`, requestId: conv.requestId });
    const payload = {
      id: String(msg._id),
      senderId: req.userId,
      sender: String(conv.customerId) === req.userId ? "customer" : "provider",
      text: msg.text,
      kind: msg.kind,
      mediaUrl: msg.mediaUrl,
      deleted: false,
      durationSec: msg.durationSec || 0,
      time: new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    };
    emitChatMessage(conv, payload);
    res.status(201).json({
      message: payload,
    });
  })
);

router.post(
  "/:id/messages/:messageId/delete",
  asyncHandler(async (req, res) => {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw httpError(404, "Conversation not found");
    const mine = String(conv.customerId) === req.userId || String(conv.providerId) === req.userId;
    if (!mine) throw httpError(403, "Not allowed");
    const msg = await Message.findOne({ _id: req.params.messageId, conversationId: conv._id });
    if (!msg) throw httpError(404, "Message not found");
    const scope = req.body.scope === "everyone" ? "everyone" : "me";
    if (scope === "everyone") {
      if (String(msg.senderId) !== req.userId) throw httpError(403, "You can only unsend your own messages");
      msg.deletedForEveryone = true;
      msg.text = "This message was deleted";
      msg.mediaUrl = "";
      await msg.save();
      if (conv.lastMessage && conv.lastMessage !== "This message was deleted") {
        conv.lastMessage = "This message was deleted";
        await conv.save();
      }
    } else {
      msg.deletedFor = [...new Set([...(msg.deletedFor || []).map(String), req.userId])];
      await msg.save();
    }
    res.json({ ok: true, scope });
  })
);

export default router;
