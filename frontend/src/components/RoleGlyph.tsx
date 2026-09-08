import React from "react";
import { Briefcase, Shield, User, Wrench } from "lucide-react";

export default function RoleGlyph({
  role,
  className = "w-7 h-7",
  boxClassName = "",
}: {
  role?: string | null;
  className?: string;
  boxClassName?: string;
}) {
  const kind = role === "worker" ? "worker" : role === "business" || role === "provider" ? "business" : role === "admin" ? "admin" : "customer";
  const Icon = kind === "worker" ? Wrench : kind === "business" ? Briefcase : kind === "admin" ? Shield : User;
  const tone =
    kind === "worker"
      ? "bg-amber-50 text-amber-700"
      : kind === "business"
        ? "bg-indigo-50 text-indigo-700"
        : kind === "admin"
          ? "bg-slate-800 text-white"
          : "bg-sky-50 text-sky-700";
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl ${tone} ${boxClassName}`}>
      <Icon className={className} />
    </span>
  );
}
