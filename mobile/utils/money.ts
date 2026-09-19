/** Typical FixBuddy job prices in ₹ when the customer did not enter an amount. */
export const CATEGORY_GUIDE_PRICES: Record<string, { min: number; typical: number; max: number }> = {
  Plumbing: { min: 299, typical: 499, max: 899 },
  Electrical: { min: 299, typical: 499, max: 999 },
  "AC Repair": { min: 499, typical: 799, max: 1499 },
  "Appliance Repair": { min: 399, typical: 699, max: 1299 },
  Carpentry: { min: 399, typical: 699, max: 1499 },
  Painting: { min: 999, typical: 1999, max: 4999 },
  Cleaning: { min: 399, typical: 699, max: 1499 },
  Welding: { min: 499, typical: 899, max: 1999 },
  Masonry: { min: 699, typical: 999, max: 2499 },
  Driver: { min: 299, typical: 499, max: 999 },
  "Moving / Loading": { min: 499, typical: 999, max: 2499 },
  Maintenance: { min: 299, typical: 499, max: 999 },
};

const FALLBACK = { min: 299, typical: 499, max: 999 };

export function guidePrice(category?: string | null) {
  const key = Object.keys(CATEGORY_GUIDE_PRICES).find(
    (name) => name.toLowerCase() === String(category || "").trim().toLowerCase()
  );
  return key ? CATEGORY_GUIDE_PRICES[key] : FALLBACK;
}

export function typicalPrice(category?: string | null) {
  return guidePrice(category).typical;
}

export function guidePriceText(category?: string | null) {
  const g = guidePrice(category);
  return `Usual price in your area: ₹${g.min}–₹${g.max}`;
}

export function jobAmountRupees(job?: {
  workerQuote?: number | null;
  estimatedAmount?: number | null;
  category?: string | null;
} | null) {
  const quoted = Number(job?.workerQuote || 0);
  if (quoted > 0) return quoted;
  const estimated = Number(job?.estimatedAmount || 0);
  if (estimated > 0) return estimated;
  return typicalPrice(job?.category);
}

export function formatRupees(amount?: number | null) {
  const n = Number(amount || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}
