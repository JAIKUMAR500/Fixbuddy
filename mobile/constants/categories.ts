export const FALLBACK_CATEGORIES = [
  { name: "Plumbing", icon: "droplets", emoji: "🔧" },
  { name: "Electrical", icon: "zap", emoji: "⚡" },
  { name: "Cleaning", icon: "sparkles", emoji: "✨" },
  { name: "Painting", icon: "paintbrush", emoji: "🎨" },
  { name: "Driver", icon: "car", emoji: "🚗" },
  { name: "Moving / Loading", icon: "truck", emoji: "🚚" },
  { name: "AC Repair", icon: "wind", emoji: "❄️" },
  { name: "Appliance Repair", icon: "plug", emoji: "🔌" },
  { name: "Carpentry", icon: "hammer", emoji: "🪵" },
  { name: "Maintenance", icon: "wrench", emoji: "🛠️" },
  { name: "Other", icon: "sparkles", emoji: "➕" },
];

const EMOJI: Record<string, string> = Object.fromEntries(FALLBACK_CATEGORIES.map((c) => [c.icon, c.emoji]));
EMOJI.home = "🏠";
EMOJI.wrench = "🛠️";
EMOJI.laptop = "💻";
EMOJI.leaf = "🌿";

export function categoryEmoji(icon?: string, name?: string) {
  if (icon && EMOJI[icon]) return EMOJI[icon];
  const n = String(name || "").toLowerCase();
  if (n.includes("plumb")) return "🔧";
  if (n.includes("electr")) return "⚡";
  if (n.includes("clean")) return "✨";
  if (n.includes("paint")) return "🎨";
  if (n.includes("driver") || n.includes("car")) return "🚗";
  if (n.includes("mov")) return "🚚";
  if (n.includes("ac")) return "❄️";
  if (n.includes("wood") || n.includes("carpent")) return "🪵";
  if (n.includes("other")) return "➕";
  return "🛠️";
}

export const TIMINGS = [
  { id: "asap", label: "Now", hint: "As soon as possible" },
  { id: "today", label: "Today", hint: "Anytime today" },
  { id: "tomorrow", label: "Later", hint: "Tomorrow" },
];
