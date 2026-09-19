import { Router } from "express";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { Request } from "../models/Request.js";
import { notify } from "../services/notify.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { isBusiness, isSeeker, isAdmin } from "../utils/roles.js";
import { presentRequest, providerCard } from "../utils/serialize.js";
import {
  LOCK_MESSAGE,
  PENDING_JOB_STATUSES,
  acquireWorkerLock,
  healWorkerLock,
  isDuplicateKeyError,
  isEngagedJobStatus,
  releaseWorkerLock,
} from "../utils/jobLock.js";

const router = Router();

function present(team, extras = {}) {
  if (!team) return { groups: [], members: [], myRole: null, canManage: false, canAssign: false };
  return {
    id: String(team._id),
    ownerId: String(team.ownerId),
    groups: (team.groups || []).map((g) => ({ id: String(g._id), name: g.name })),
    members: (team.members || []).map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email || "",
      phone: m.phone || "",
      role: normalizeTeamRole(m.role),
      groupId: m.groupId || "",
      status: m.status,
      userId: m.userId ? String(m.userId) : null,
      invitedAt: m.invitedAt || null,
      acceptedAt: m.acceptedAt || null,
    })),
    myRole: extras.myRole || null,
    canManage: !!extras.canManage,
    canAssign: !!extras.canAssign,
  };
}

function normalizeTeamRole(role) {
  if (role === "owner" || role === "manager" || role === "worker") return role;
  if (role === "lead") return "manager";
  if (role === "staff") return "worker";
  return "worker";
}

async function loadOwnedTeam(ownerId) {
  let team = await Team.findOne({ ownerId });
  if (!team) team = await Team.create({ ownerId, groups: [], members: [] });
  return team;
}

/**
 * Resolve Business Owner / Manager / Worker access.
 * - Business account that owns the team → Owner
 * - Active member with manager role → Manager (invite/assign)
 * - Active member with worker role → Worker (execute assigned jobs only)
 */
async function resolveTeamAccess(req, { needManage = false, needAssign = false } = {}) {
  if (isAdmin(req.user.role)) {
    const ownerId = req.body?.ownerId || req.query?.ownerId || req.userId;
    const team = await loadOwnedTeam(ownerId);
    return { team, myRole: "owner", canManage: true, canAssign: true };
  }

  if (isBusiness(req.user.role)) {
    const team = await loadOwnedTeam(req.userId);
    return { team, myRole: "owner", canManage: true, canAssign: true };
  }

  if (isSeeker(req.user.role)) {
    const team = await Team.findOne({
      members: { $elemMatch: { userId: req.userId, status: "active" } },
    });
    if (!team) throw httpError(403, "You are not on a Business Team");
    const member = (team.members || []).find((m) => String(m.userId) === String(req.userId) && m.status === "active");
    const role = normalizeTeamRole(member?.role);
    const canManage = role === "owner" || role === "manager";
    const canAssign = canManage;
    if (needManage && !canManage) throw httpError(403, "Only Business Owner or Manager can do this");
    if (needAssign && !canAssign) throw httpError(403, "Only Business Owner or Manager can assign jobs");
    return { team, myRole: role, canManage, canAssign };
  }

  throw httpError(403, "Business or worker accounts only");
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (isBusiness(req.user.role) || isAdmin(req.user.role)) {
      const access = await resolveTeamAccess(req);
      return res.json({ team: present(access.team, access) });
    }
    if (isSeeker(req.user.role)) {
      const teams = await Team.find({ "members.userId": req.userId }).lean();
      const ownerIds = teams.map((t) => t.ownerId);
      const owners = await User.find({ _id: { $in: ownerIds } }).select("name provider").lean();
      const ownerMap = Object.fromEntries(owners.map((u) => [String(u._id), u]));
      const managed = teams.find((t) =>
        (t.members || []).some(
          (m) =>
            String(m.userId) === String(req.userId) &&
            m.status === "active" &&
            ["manager", "owner", "lead"].includes(m.role)
        )
      );
      let teamPayload = null;
      if (managed) {
        const member = (managed.members || []).find((m) => String(m.userId) === String(req.userId));
        const role = normalizeTeamRole(member?.role);
        teamPayload = present(managed, {
          myRole: role,
          canManage: role === "manager" || role === "owner",
          canAssign: role === "manager" || role === "owner",
        });
      }
      return res.json({
        team: teamPayload,
        memberships: teams.map((t) => {
          const m = (t.members || []).find((x) => String(x.userId) === String(req.userId));
          const owner = ownerMap[String(t.ownerId)];
          return {
            teamId: String(t._id),
            ownerId: String(t.ownerId),
            businessName: owner?.provider?.businessName || owner?.name || "Business",
            member: m
              ? {
                  id: String(m._id),
                  status: m.status,
                  role: normalizeTeamRole(m.role),
                  name: m.name,
                }
              : null,
          };
        }),
      });
    }
    throw httpError(403, "Business or worker accounts only");
  })
);

router.get(
  "/search-workers",
  asyncHandler(async (req, res) => {
    await resolveTeamAccess(req, { needManage: true });
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ workers: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const rows = await User.find({
      role: "worker",
      status: "active",
      $or: [{ name: rx }, { userCode: rx }, { email: rx }, { "provider.businessName": rx }, { "provider.category": rx }],
    })
      .limit(20)
      .lean();
    res.json({
      workers: rows.map((u) => ({
        id: String(u._id),
        name: u.provider?.businessName || u.name,
        userCode: u.userCode || "",
        category: u.provider?.category || "",
        verified: !!u.provider?.verified,
        ratingAvg: u.provider?.ratingAvg || 0,
        avatar: u.avatar || "",
      })),
    });
  })
);

router.post(
  "/groups",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Group name is required");
    access.team.groups.push({ name });
    await access.team.save();
    res.status(201).json({ team: present(access.team, access) });
  })
);

router.patch(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const group = access.team.groups.id(req.params.id);
    if (!group) throw httpError(404, "Group not found");
    if (req.body.name != null) group.name = String(req.body.name).trim() || group.name;
    await access.team.save();
    res.json({ team: present(access.team, access) });
  })
);

router.delete(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    access.team.members.forEach((m) => {
      if (m.groupId === req.params.id) m.groupId = "";
    });
    access.team.groups.pull(req.params.id);
    await access.team.save();
    res.json({ team: present(access.team, access) });
  })
);

router.post(
  "/members",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const { name, email, phone, role, groupId, userId } = req.body || {};
    if (userId) {
      const worker = await User.findOne({ _id: userId, role: "worker", status: "active" });
      if (!worker) throw httpError(404, "Worker not found");
      const existing = access.team.members.find((m) => String(m.userId) === String(userId));
      if (existing?.status === "active") throw httpError(409, "Worker is already on your team");
      if (existing?.status === "pending") throw httpError(409, "Invite already pending");
      access.team.members.push({
        name: worker.provider?.businessName || worker.name,
        email: worker.email || "",
        phone: worker.phone || "",
        role: normalizeTeamRole(role),
        groupId: groupId || "",
        status: "pending",
        userId: worker._id,
        invitedBy: req.userId,
        invitedAt: new Date(),
      });
      await access.team.save();
      const owner = await User.findById(access.team.ownerId).select("name provider").lean();
      await notify(worker._id, {
        type: "info",
        text: `${owner?.provider?.businessName || owner?.name || "A business"} invited you to join their Business Team.`,
      });
      return res.status(201).json({ team: present(access.team, access) });
    }
    if (!String(name || "").trim()) throw httpError(400, "Member name is required");
    let linkedUserId = null;
    if (email) {
      const existing = await User.findOne({ email: String(email).toLowerCase(), role: "worker" }).lean();
      if (existing) linkedUserId = existing._id;
    }
    access.team.members.push({
      name: String(name).trim(),
      email: String(email || "").toLowerCase(),
      phone: phone || "",
      role: normalizeTeamRole(role),
      groupId: groupId || "",
      status: "pending",
      userId: linkedUserId,
      invitedBy: req.userId,
      invitedAt: new Date(),
    });
    await access.team.save();
    if (linkedUserId) {
      const owner = await User.findById(access.team.ownerId).select("name provider").lean();
      await notify(linkedUserId, {
        type: "info",
        text: `${owner?.provider?.businessName || owner?.name || "A business"} invited you to join their Business Team.`,
      });
    }
    res.status(201).json({ team: present(access.team, access) });
  })
);

router.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const userId = req.body.userId || req.body.workerId;
    if (!userId) throw httpError(400, "Pick a worker to invite");
    const worker = await User.findOne({ _id: userId, role: "worker", status: "active" });
    if (!worker) throw httpError(404, "Worker not found");
    const existing = access.team.members.find((m) => String(m.userId) === String(userId));
    if (existing?.status === "active") throw httpError(409, "Worker is already on your team");
    if (existing?.status === "pending") throw httpError(409, "Invite already pending");
    const nextRole = normalizeTeamRole(req.body.role);
    if (nextRole === "owner" && access.myRole !== "owner") {
      throw httpError(403, "Only the Business Owner can assign the owner role");
    }
    access.team.members.push({
      name: worker.provider?.businessName || worker.name,
      email: worker.email || "",
      phone: worker.phone || "",
      role: nextRole === "owner" ? "manager" : nextRole,
      groupId: req.body.groupId || "",
      status: "pending",
      userId: worker._id,
      invitedBy: req.userId,
      invitedAt: new Date(),
    });
    await access.team.save();
    const owner = await User.findById(access.team.ownerId).select("name provider").lean();
    await notify(worker._id, {
      type: "info",
      text: `${owner?.provider?.businessName || owner?.name || "A business"} invited you to join their Business Team.`,
    });
    res.status(201).json({ team: present(access.team, access) });
  })
);

router.post(
  "/invitations/:memberId/accept",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const team = await Team.findOne({ "members._id": req.params.memberId });
    if (!team) throw httpError(404, "Invitation not found");
    const member = team.members.id(req.params.memberId);
    if (!member || String(member.userId) !== String(req.userId)) throw httpError(403, "This invite is not for you");
    if (member.status === "active") return res.json({ team: present(team, { myRole: normalizeTeamRole(member.role), canManage: false, canAssign: false }) });
    member.status = "active";
    member.acceptedAt = new Date();
    await team.save();
    await notify(team.ownerId, {
      type: "success",
      text: `${req.user.name} joined your Business Team`,
    });
    res.json({
      team: present(team, {
        myRole: normalizeTeamRole(member.role),
        canManage: ["manager", "owner"].includes(normalizeTeamRole(member.role)),
        canAssign: ["manager", "owner"].includes(normalizeTeamRole(member.role)),
      }),
    });
  })
);

router.post(
  "/invitations/:memberId/reject",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const team = await Team.findOne({ "members._id": req.params.memberId });
    if (!team) throw httpError(404, "Invitation not found");
    const member = team.members.id(req.params.memberId);
    if (!member || String(member.userId) !== String(req.userId)) throw httpError(403, "This invite is not for you");
    team.members.pull(member._id);
    await team.save();
    res.json({ ok: true });
  })
);

/** Worker leaves Business Team — keeps Worker account intact. */
router.post(
  "/leave",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const teamId = req.body.teamId;
    const team = teamId
      ? await Team.findById(teamId)
      : await Team.findOne({ "members.userId": req.userId });
    if (!team) throw httpError(404, "Business Team not found");
    const member = (team.members || []).find((m) => String(m.userId) === String(req.userId));
    if (!member) throw httpError(404, "You are not on this Business Team");

    const locked = await Request.findOne({
      providerId: req.userId,
      assignmentMode: "business_team",
      status: { $in: ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"] },
      customerId: team.ownerId,
    }).lean();
    if (locked) throw httpError(409, "Finish your active business-assigned job before leaving the team.");

    team.members = team.members.filter((m) => String(m.userId) !== String(req.userId));
    await team.save();
    await notify(team.ownerId, { type: "info", text: `${req.user.name} left your Business Team` });
    res.json({ ok: true, left: true });
  })
);

router.patch(
  "/members/:id",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const member = access.team.members.id(req.params.id);
    if (!member) throw httpError(404, "Member not found");
    const { name, email, phone, role, groupId, status } = req.body || {};
    if (name != null) member.name = String(name).trim() || member.name;
    if (email != null) member.email = String(email).toLowerCase();
    if (phone != null) member.phone = phone;
    if (role != null) {
      const next = normalizeTeamRole(role);
      if (next === "owner" && access.myRole !== "owner") {
        throw httpError(403, "Only the Business Owner can set owner role");
      }
      member.role = next === "owner" ? "manager" : next;
    }
    if (groupId != null) member.groupId = groupId;
    if (status === "active" || status === "pending") member.status = status;
    await access.team.save();
    res.json({ team: present(access.team, access) });
  })
);

router.delete(
  "/members/:id",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needManage: true });
    const member = access.team.members.id(req.params.id);
    if (member?.userId) {
      const owner = await User.findById(access.team.ownerId).select("name provider").lean();
      await notify(member.userId, {
        type: "info",
        text: `You were removed from ${owner?.provider?.businessName || owner?.name || "the business"}'s Business Team`,
      });
    }
    access.team.members.pull(req.params.id);
    await access.team.save();
    res.json({ team: present(access.team, access) });
  })
);

router.post(
  "/assign-job",
  asyncHandler(async (req, res) => {
    const access = await resolveTeamAccess(req, { needAssign: true });
    const requestId = req.body.requestId;
    const workerId = req.body.workerId || req.body.userId;
    if (!requestId || !workerId) throw httpError(400, "requestId and workerId are required");

    const member = access.team.members.find(
      (m) => String(m.userId) === String(workerId) && m.status === "active"
    );
    if (!member) throw httpError(400, "Worker must be an active member of your Business Team");

    const worker = await User.findOne({ _id: workerId, role: "worker", status: "active" });
    if (!worker) throw httpError(404, "Worker not found");

    const existing = await Request.findById(requestId);
    if (!existing) throw httpError(404, "Request not found");
    if (String(existing.customerId) !== String(access.team.ownerId) && !isAdmin(req.user.role)) {
      throw httpError(403, "Not your business job");
    }
    if (String(existing.providerId || "") === String(workerId) && isEngagedJobStatus(existing.status)) {
      await healWorkerLock(workerId, existing._id).catch(() => {});
      return res.json({ ok: true, request: presentRequest(existing, { provider: providerCard(worker) }) });
    }
    if (!PENDING_JOB_STATUSES.includes(existing.status) || existing.providerId) {
      throw httpError(409, "This job is no longer available");
    }
    if (existing.crewId) throw httpError(409, "This job is reserved for a crew");

    let lock;
    try {
      lock = await acquireWorkerLock(workerId, requestId);
    } catch (err) {
      if (err.status === 409) throw httpError(409, "Worker unavailable — already on an active job");
      throw err;
    }

    let taken;
    try {
      taken = await Request.findOneAndUpdate(
        {
          _id: requestId,
          status: { $in: PENDING_JOB_STATUSES },
          $or: [{ providerId: null }, { providerId: { $exists: false } }],
        },
        {
          $set: {
            providerId: workerId,
            status: "accepted",
            acceptedAt: new Date(),
            assignmentMode: "business_team",
          },
          $push: {
            timeline: {
              status: "accepted",
              note: `Business assigned ${worker.provider?.businessName || worker.name}`,
              at: new Date(),
            },
          },
        },
        { new: true }
      );
    } catch (err) {
      if (lock.created) await releaseWorkerLock(workerId, requestId);
      if (isDuplicateKeyError(err)) throw httpError(409, LOCK_MESSAGE);
      throw err;
    }

    if (!taken) {
      if (lock.created) await releaseWorkerLock(workerId, requestId);
      throw httpError(409, "This job is no longer available");
    }

    const owner = await User.findById(access.team.ownerId).select("name provider").lean();
    await notify(workerId, {
      type: "request",
      text: `${owner?.provider?.businessName || owner?.name || "Business"} assigned you a job: ${taken.category}`,
      requestId: taken._id,
    });

    res.json({
      ok: true,
      request: presentRequest(taken, { provider: providerCard(worker) }),
    });
  })
);

export default router;
