import { Router } from "express";
import { User } from "../models/User.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { publicUser, providerCard } from "../utils/serialize.js";
import { isProviderAccount } from "../utils/roles.js";
import { km, isOnline } from "../utils/geo.js";
import { paramObjectId } from "../middleware/validate.js";
import { WorkerLock } from "../models/WorkerLock.js";

const router = Router();
router.param("id", paramObjectId("id"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {
      role: "worker",
      status: "active",
      "provider.onboarded": true,
    };
    if (req.query.city) filter.city = new RegExp(String(req.query.city), "i");
    if (req.query.category) filter["provider.category"] = new RegExp(String(req.query.category), "i");
    if (req.query.available === "true") filter["provider.available"] = true;
    if (req.query.q) {
      const q = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: q }, { "provider.businessName": q }, { "provider.category": q }, { "provider.services": q }];
    }
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const maxKm = req.query.maxKm != null ? Number(req.query.maxKm) : 40;
    const minRating = req.query.minRating != null ? Number(req.query.minRating) : 0;
    const rows = await User.find(filter).sort({ "provider.ratingAvg": -1 }).limit(80).lean();
    const busy = await WorkerLock.find({ userId: { $in: rows.map((u) => u._id) } }).select("userId").lean();
    const busySet = new Set(busy.map((row) => String(row.userId)));
    let providers = rows
      .filter((u) => !busySet.has(String(u._id)))
      .map((u) => {
        const dist = km(lat, lng, u.lat ?? u.provider?.lat, u.lng ?? u.provider?.lng);
        return providerCard(u, { distance: dist != null ? `${dist.toFixed(1)} km` : "nearby", score: dist == null ? 999 : dist });
      })
      .filter((p) => (p.rating || 0) >= minRating);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      providers = providers
        .filter((p) => {
          const n = Number.parseFloat(p.distance);
          return !Number.isFinite(n) || n <= maxKm;
        })
        .sort((a, b) => (a.score || 0) - (b.score || 0));
    }
    res.json({
      providers: providers.slice(0, 40).map((p) => ({
        ...p,
        online: p.online || isOnline(p.lastSeenAt),
      })),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: { $in: ["worker", "business", "provider"] } }).lean();
    if (!user) throw httpError(404, "Provider not found");
    res.json({ provider: providerCard(user) });
  })
);

router.post(
  "/onboarding",
  asyncHandler(async (req, res) => {
    if (!isProviderAccount(req.user.role)) throw httpError(403, "Only workers and businesses can onboard");
    const body = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          name: body.businessName || req.user.name,
          city: body.city || req.user.city,
          area: body.area || req.user.area,
          address: body.address || req.user.address,
          phone: body.phone || req.user.phone,
          lat: body.lat != null ? Number(body.lat) : req.user.lat,
          lng: body.lng != null ? Number(body.lng) : req.user.lng,
          avatar: body.avatar || req.user.avatar,
          "provider.businessName": body.businessName || req.user.name,
          "provider.category": body.category || "",
          "provider.services": body.services || [],
          "provider.serviceAreas": body.serviceAreas || [],
          "provider.hours": body.hours || { from: "08:00", to: "20:00" },
          "provider.description": body.description || "",
          "provider.experience": body.experience || "",
          "provider.location": body.location || "",
          "provider.website": body.website || "",
          "provider.startingPrice": Number(body.startingPrice || 399),
          "provider.photos": body.photos || [],
          "provider.coverPhoto": body.coverPhoto || "",
          "provider.gstCertificate": body.gstCertificate || "",
          "provider.aadhaarCard": body.aadhaarCard || "",
          "provider.panCard": body.panCard || "",
          "provider.lat": body.lat != null ? Number(body.lat) : null,
          "provider.lng": body.lng != null ? Number(body.lng) : null,
          "provider.onboarded": true,
          "provider.available": true,
        },
      },
      { new: true }
    ).lean();
    res.json({ user: publicUser(user) });
  })
);

router.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    if (!isProviderAccount(req.user.role)) throw httpError(403, "Worker or business only");
    const body = req.body || {};
    const set = {};
    const map = {
      businessName: "provider.businessName",
      category: "provider.category",
      services: "provider.services",
      serviceAreas: "provider.serviceAreas",
      hours: "provider.hours",
      description: "provider.description",
      experience: "provider.experience",
      location: "provider.location",
      website: "provider.website",
      coverPhoto: "provider.coverPhoto",
      startingPrice: "provider.startingPrice",
      available: "provider.available",
      responseTime: "provider.responseTime",
      photos: "provider.photos",
      gstCertificate: "provider.gstCertificate",
      aadhaarCard: "provider.aadhaarCard",
      panCard: "provider.panCard",
    };
    for (const [k, path] of Object.entries(map)) {
      if (body[k] !== undefined) set[path] = body[k];
    }
    if (!req.user.provider) {
      set["provider.businessName"] = set["provider.businessName"] || req.user.name;
      set["provider.onboarded"] = true;
      set["provider.available"] = true;
    }
    if (body.avatar) set.avatar = body.avatar;
    if (body.phone != null) set.phone = body.phone;
    if (body.city) set.city = body.city;
    if (body.area) set.area = body.area;
    if (body.lat != null) {
      set.lat = Number(body.lat);
      set["provider.lat"] = Number(body.lat);
    }
    if (body.lng != null) {
      set.lng = Number(body.lng);
      set["provider.lng"] = Number(body.lng);
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true }).lean();
    res.json({ user: publicUser(user) });
  })
);

export default router;
