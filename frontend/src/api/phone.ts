export function phoneDigits(phone?: string | null) {
  return String(phone || "").replace(/\D/g, "");
}

export function dialHref(phone?: string | null) {
  const digits = phoneDigits(phone);
  if (digits.length < 8) return "";
  if (digits.startsWith("91") && digits.length >= 12) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+91${digits}`;
  return `tel:+${digits}`;
}

export function jobAllowsCall(status?: string | null) {
  return [
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
  ].includes(String(status || ""));
}

export function startCall(phone?: string | null) {
  const href = dialHref(phone);
  const shown = String(phone || "").trim();
  if (!href) {
    window.alert("No phone number yet. It appears after the worker accepts the job.");
    return false;
  }
  const digits = phoneDigits(phone);
  void navigator.clipboard?.writeText(digits.startsWith("91") ? `+${digits}` : digits).catch(() => {});
  window.location.href = href;
  if (!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    window.setTimeout(() => {
      window.alert(`Call ${shown || href.replace("tel:", "")}\n\nThe number is copied. Paste it in your phone if this computer cannot dial.`);
    }, 250);
  }
  return true;
}
