import { User } from "../models/User.js";

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function km(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function matchProviders(request) {
  const providers = await User.find({
    role: "worker",
    status: "active",
    "provider.onboarded": true,
    "provider.available": true,
  })
    .select("name avatar phone city area lat lng provider")
    .lean();

  const descTokens = tokenize(request.description);
  const area = String(request.area || "").toLowerCase();
  const city = String(request.city || "").toLowerCase();
  const category = String(request.category || "").toLowerCase();

  const scored = providers
    .map((p) => {
      const prof = p.provider || {};
      let score = 0;
      const reasons = [];
      const pLat = p.lat ?? prof.lat;
      const pLng = p.lng ?? prof.lng;
      const dist = km(request.lat, request.lng, pLat, pLng);
      const pCat = String(prof.category || "").toLowerCase();
      if (pCat && pCat === category) {
        score += 50;
        reasons.push("category match");
      } else if (pCat && (category.includes(pCat) || pCat.includes(category.split(" ")[0]))) {
        score += 28;
        reasons.push("related category");
      }
      const areas = (prof.serviceAreas || []).map((a) => a.toLowerCase());
      if (area && areas.some((a) => a.includes(area) || area.includes(a))) {
        score += 20;
        reasons.push("service area");
      }
      if (city && String(p.city || "").toLowerCase() === city) {
        score += 10;
        reasons.push("same city");
      }
      if (dist != null) {
        if (dist <= 3) {
          score += 30;
          reasons.push("very near");
        } else if (dist <= 8) {
          score += 20;
          reasons.push("nearby");
        } else if (dist <= 20) {
          score += 10;
          reasons.push("in range");
        }
      }
      const hay = `${prof.description || ""} ${(prof.services || []).map((s) => (typeof s === "string" ? s : s?.name || "")).join(" ")}`.toLowerCase();
      const hits = descTokens.filter((t) => hay.includes(t)).length;
      score += Math.min(15, hits * 3);
      if (prof.verified) score += 8;
      if (prof.available) score += 6;
      score += Math.min(10, Number(prof.ratingAvg || 0) * 2);
      const distanceLabel = dist != null ? `${dist.toFixed(1)} km` : "nearby";
      return { provider: p, score, reason: reasons.join(", ") || "available nearby", distance: distanceLabel };
    })
    .filter((x) => x.score >= 18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);

  return scored;
}
