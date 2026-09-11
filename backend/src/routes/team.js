import { Router } from "express";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { isBusiness } from "../utils/roles.js";

const router = Router();

function present(team) {
  if (!team) return { groups: [], members: [] };
  return {
    id: String(team._id),
    groups: (team.groups || []).map((g) => ({ id: String(g._id), name: g.name })),
    members: (team.members || []).map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email || "",
      phone: m.phone || "",
      role: m.role,
      groupId: m.groupId || "",
      status: m.status,
      userId: m.userId ? String(m.userId) : null,
    })),
  };
}

function canManageTeam(role) {
  return isBusiness(role) || role === "worker" || role === "admin";
}

async function loadTeam(ownerId) {
  let team = await Team.findOne({ ownerId });
  if (!team) team = await Team.create({ ownerId, groups: [], members: [] });
  return team;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const team = await loadTeam(req.userId);
    res.json({ team: present(team) });
  })
);

router.post(
  "/groups",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Group name is required");
    const team = await loadTeam(req.userId);
    team.groups.push({ name });
    await team.save();
    res.status(201).json({ team: present(team) });
  })
);

router.patch(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const team = await loadTeam(req.userId);
    const group = team.groups.id(req.params.id);
    if (!group) throw httpError(404, "Group not found");
    if (req.body.name != null) group.name = String(req.body.name).trim() || group.name;
    await team.save();
    res.json({ team: present(team) });
  })
);

router.delete(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const team = await loadTeam(req.userId);
    team.members.forEach((m) => {
      if (m.groupId === req.params.id) m.groupId = "";
    });
    team.groups.pull(req.params.id);
    await team.save();
    res.json({ team: present(team) });
  })
);

router.post(
  "/members",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const { name, email, phone, role, groupId } = req.body || {};
    if (!String(name || "").trim()) throw httpError(400, "Member name is required");
    const team = await loadTeam(req.userId);
    let userId = null;
    let status = "pending";
    if (email) {
      const existing = await User.findOne({ email: String(email).toLowerCase() }).lean();
      if (existing && (existing.role === "worker" || existing.role === "business" || existing.role === "provider")) {
        userId = existing._id;
        status = "active";
      }
    }
    team.members.push({
      name: String(name).trim(),
      email: String(email || "").toLowerCase(),
      phone: phone || "",
      role: role === "lead" ? "lead" : "staff",
      groupId: groupId || "",
      status,
      userId,
    });
    await team.save();
    res.status(201).json({ team: present(team) });
  })
);

router.patch(
  "/members/:id",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const team = await loadTeam(req.userId);
    const member = team.members.id(req.params.id);
    if (!member) throw httpError(404, "Member not found");
    const { name, email, phone, role, groupId, status } = req.body || {};
    if (name != null) member.name = String(name).trim() || member.name;
    if (email != null) member.email = String(email).toLowerCase();
    if (phone != null) member.phone = phone;
    if (role === "lead" || role === "staff") member.role = role;
    if (groupId != null) member.groupId = groupId;
    if (status === "active" || status === "pending") member.status = status;
    await team.save();
    res.json({ team: present(team) });
  })
);

router.delete(
  "/members/:id",
  asyncHandler(async (req, res) => {
    if (!canManageTeam(req.user.role)) throw httpError(403, "Business or worker accounts only");
    const team = await loadTeam(req.userId);
    team.members.pull(req.params.id);
    await team.save();
    res.json({ team: present(team) });
  })
);

export default router;
