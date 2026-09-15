export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees) {
  const n = Math.trunc(Number(rupees) || 0);
  return n < 0 ? 0 : n * PAISE_PER_RUPEE;
}

export function paiseToRupees(paise) {
  const n = Math.trunc(Number(paise) || 0);
  return n < 0 ? 0 : Math.trunc(n / PAISE_PER_RUPEE);
}

export function clampPercent(percent) {
  const n = Math.trunc(Number(percent) || 0);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Integer commission: floor(pricePaise * percent / 100). Never uses float rupees. */
export function commissionPaise(pricePaise, percent) {
  const price = Math.max(0, Math.trunc(Number(pricePaise) || 0));
  const pct = clampPercent(percent);
  return Math.trunc((price * pct) / 100);
}

export function netPaise(pricePaise, commission) {
  const price = Math.max(0, Math.trunc(Number(pricePaise) || 0));
  const fee = Math.max(0, Math.trunc(Number(commission) || 0));
  return Math.max(0, price - fee);
}
