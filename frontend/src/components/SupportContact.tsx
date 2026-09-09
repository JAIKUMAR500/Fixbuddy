import React from "react";
import { LifeBuoy, MessageCircle } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "../api/brand";
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
      <div className={className}>
        <a href={mailto} className="inline-flex items-center gap-2">
          <LifeBuoy className="w-5 h-5" /> Contact support
        </a>
        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer" aria-label="Open FixBuddy WhatsApp support" title="WhatsApp support" className="inline-flex items-center gap-2 ml-4">
          <MessageCircle className="w-5 h-5" /> WhatsApp
        </a>
      </div>
    );
  }

  if (variant === "stack") {
    return (
      <div className={className}>
        <a href={mailto} className="block">
          <span className="block font-semibold">Contact support</span>
          <span className="block">{email}</span>
        </a>
        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer" aria-label="Open FixBuddy WhatsApp support" title="WhatsApp support" className="inline-flex items-center gap-1 mt-2 text-emerald-600">
          <MessageCircle className="w-4 h-4" /> WhatsApp support
        </a>
      </div>
    );
  }

  return (
    <span className={className}>
      <a href={mailto}>Contact support · {email}</a>
      <a href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer" aria-label="Open FixBuddy WhatsApp support" title="WhatsApp support" className="inline-flex items-center gap-1 ml-3 text-emerald-600">
        <MessageCircle className="w-4 h-4" /> WhatsApp
      </a>
    </span>
  );
}
