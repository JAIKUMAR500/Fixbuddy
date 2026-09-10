import { Router } from "express";
import { Category } from "../models/Category.js";
import { auth, requireRole } from "../middleware/auth.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const cached = cacheGet("categories:active");
    if (cached) return res.json(cached);
    const rows = await Category.find({ active: true }).sort({ name: 1 }).lean();
    const payload = { categories: rows };
    cacheSet("categories:active", payload, 60_000);
    res.json(payload);
  })
);

router.get(
  "/all",
  auth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const rows = await Category.find().sort({ name: 1 }).lean();
    res.json({ categories: rows });
  })
);

router.post(
  "/",
  auth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { name, icon, description, services } = req.body || {};
    if (!name) throw httpError(400, "Category name is required");
    const doc = await Category.create({
      name,
      icon: icon || "🔧",
      description: description || "",
      services: services || [],
      active: true,
    });
    await logAudit(req, "Created category", name);
    cacheDel("categories:active");
    cacheDel("public:stats");
    res.status(201).json({ category: doc });
  })
);

router.patch(
  "/:id",
  auth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const set = {};
    for (const k of ["name", "icon", "description", "active", "services"]) {
      if (req.body[k] !== undefined) set[k] = req.body[k];
    }
    const doc = await Category.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (!doc) throw httpError(404, "Category not found");
    await logAudit(req, "Updated category", doc.name);
    cacheDel("categories:active");
    cacheDel("public:stats");
    res.json({ category: doc });
  })
);

export default router;
