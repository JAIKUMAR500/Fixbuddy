export type AppRole = "customer" | "worker" | "business" | "admin" | "provider";

export function publicRole(role?: string | null): "customer" | "worker" | "business" | "admin" {
  if (role === "provider" || role === "business") return "business";
  if (role === "worker") return "worker";
  if (role === "admin") return "admin";
  return "customer";
}

export function homePath(role?: string | null) {
  const r = publicRole(role);
  if (r === "worker") return "/worker/home";
  if (r === "business") return "/business/home";
  if (r === "admin") return "/customer/home";
  return "/customer/home";
}

export function activeJobPath(role?: string | null) {
  const r = publicRole(role);
  if (r === "worker") return "/worker/active-job";
  if (r === "business") return "/business/active-job";
  return "/customer/active-job";
}

export function greetingName(name?: string) {
  const hour = new Date().getHours();
  const hi = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${hi}${name ? `, ${name.split(" ")[0]}` : ""} 👋`;
}
