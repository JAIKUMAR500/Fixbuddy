import { Router } from "express";
import { User } from "../models/User.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { publicUser, providerCard } from "../utils/serialize.js";
import { isProviderAccount } from "../utils/roles.js";

const router = Router();

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
    const rows = await User.find(filter).sort({ "provider.ratingAvg": -1 }).limit(40).lean();
    res.json({ providers: rows.map((u) => providerCard(u)) });
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
