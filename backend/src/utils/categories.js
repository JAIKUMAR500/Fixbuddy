import { Category } from "../models/Category.js";
import { cacheDel } from "./cache.js";

export const CANONICAL_CATEGORIES = [
  { name: "Plumbing", icon: "droplets", description: "Leaks, taps, bathrooms and water lines" },
  { name: "Electrical", icon: "zap", description: "Wiring, switches, fans and inverters" },
  { name: "AC Repair", icon: "wind", description: "Split, window and cassette AC service" },
  { name: "Appliance Repair", icon: "plug", description: "Fridge, washing machine and kitchen appliances" },
  { name: "Carpentry", icon: "hammer", description: "Doors, furniture and woodwork" },
  { name: "Painting", icon: "paintbrush", description: "Interior and exterior painting" },
  { name: "Cleaning", icon: "sparkles", description: "Home and office cleaning" },
  { name: "Welding", icon: "wrench", description: "Gates, grills and metal work" },
  { name: "Masonry", icon: "home", description: "Walls, plaster and tile work" },
  { name: "Driver", icon: "car", description: "Local driving and pickup help" },
  { name: "Moving / Loading", icon: "truck", description: "Shifting, loading and unloading" },
  { name: "Maintenance", icon: "wrench", description: "General one-day repair and upkeep" },
];

const CANONICAL_NAMES = new Set(CANONICAL_CATEGORIES.map((c) => c.name.toLowerCase()));

export async function ensureCanonicalCategories() {
  for (const cat of CANONICAL_CATEGORIES) {
    await Category.updateOne(
      { name: cat.name },
      { $set: { ...cat, active: true } },
      { upsert: true }
    );
  }
  const rows = await Category.find().select("name").lean();
  for (const row of rows) {
    if (!CANONICAL_NAMES.has(String(row.name || "").toLowerCase())) {
      await Category.updateOne({ _id: row._id }, { $set: { active: false } });
    }
  }
  cacheDel("categories:active");
  cacheDel("public:stats");
}
