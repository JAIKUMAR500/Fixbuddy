import React from "react";
import { LifeBuoy } from "lucide-react";
import { SUPPORT_EMAIL } from "../api/brand";
import { useFetch } from "../api/AppContext";

export function useSupportEmail() {
  const { data } = useFetch<{ supportEmail?: string }>("/public/config");
  const email = (data?.supportEmail || SUPPORT_EMAIL).trim() || SUPPORT_EMAIL;
  const mailto = `mailto:${email}?subject=${encodeURIComponent("FixBuddy support")}`;
  return { email, mailto };
}

export default function SupportContact({
  className = "",
  variant = "link",
}: {
  className?: string;
  variant?: "link" | "button" | "stack";
}) {
  const { email, mailto } = useSupportEmail();

  if (variant === "button") {
    return (
      <a href={mailto} className={className}>
        <LifeBuoy className="w-5 h-5" /> Contact support
      </a>
    );
  }

  if (variant === "stack") {
    return (
      <a href={mailto} className={className}>
        <span className="block font-semibold">Contact support</span>
        <span className="block">{email}</span>
      </a>
    );
  }

  return (
    <a href={mailto} className={className}>
      Contact support · {email}
    </a>
  );
}
