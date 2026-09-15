import React, { useState } from "react";
import { Star } from "lucide-react";
import { mediaUrl } from "../api/client";

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "plain";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer select-none";
  const variants = {
    primary:
      "bg-brand text-white hover:bg-brand-dark active:bg-blue-900 focus:ring-brand shadow-sm",
    secondary:
      "bg-brand-soft text-brand hover:bg-blue-100 active:bg-blue-200 focus:ring-brand",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-300",
    outline:
      "border border-blue-200 text-brand hover:bg-brand-soft active:bg-blue-100 focus:ring-brand",
    danger:
      "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-400",
    plain: "focus:ring-brand",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral" | "primary";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  const variants = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-600",
    info: "bg-brand-soft text-brand",
    neutral: "bg-slate-100 text-slate-600",
    primary: "bg-brand text-white",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    matching: { label: "Matching", variant: "neutral" },
    open: { label: "Open", variant: "info" },
    requested: { label: "Requested", variant: "warning" },
    accepted: { label: "Accepted", variant: "info" },
    scheduled: { label: "Scheduled", variant: "warning" },
    upcoming: { label: "Upcoming", variant: "warning" },
    completed: { label: "Completed", variant: "success" },
    reviewed: { label: "Reviewed", variant: "success" },
    cancelled: { label: "Cancelled", variant: "error" },
    declined: { label: "Declined", variant: "error" },
    in_progress: { label: "In Progress", variant: "primary" },
    "in-progress": { label: "In Progress", variant: "primary" },
    on_the_way: { label: "On the way", variant: "info" },
    arrived: { label: "Arrived", variant: "warning" },
    otp_verified: { label: "OTP verified", variant: "info" },
    payment_collected: { label: "Payment collected", variant: "success" },
    customer_completed: { label: "Awaiting review", variant: "success" },
    pending: { label: "Pending", variant: "neutral" },
    new: { label: "New", variant: "info" },
    investigating: { label: "Investigating", variant: "warning" },
    resolved: { label: "Resolved", variant: "success" },
    paid: { label: "Paid", variant: "success" },
    refunded: { label: "Refunded", variant: "error" },
    expired: { label: "Expired", variant: "error" },
    revoked: { label: "Revoked", variant: "error" },
    active: { label: "Active", variant: "success" },
  };
  const entry = map[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", padding = "md", ...props }: CardProps) {
  const pads = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };
  const customBg = /(^|\s)(!?bg-)/.test(className);
  const customBorder = /(^|\s)border-/.test(className);
  return (
    <div
      className={`rounded-2xl shadow-sm ${pads[padding]} ${customBg ? "" : "bg-white"} ${customBorder ? "border" : "border border-slate-200"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all ${icon ? "pl-10" : ""} ${error ? "border-red-400 focus:ring-red-400" : ""} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all resize-none ${error ? "border-red-400 focus:ring-red-400" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base", xl: "w-16 h-16 text-xl", "2xl": "w-24 h-24 text-2xl" };
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const href = mediaUrl(src);
  React.useEffect(() => {
    setFailed(false);
  }, [href]);
  const fallback = (
    <div className={`${sizes[size]} rounded-full bg-brand-soft text-brand font-semibold flex items-center justify-center flex-shrink-0 ${className}`}>
      {initials}
    </div>
  );
  if (!href || failed) return fallback;
  return (
    <img
      src={href}
      alt={name}
      className={`${sizes[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export function SafeImg({
  src,
  alt = "",
  className = "",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const href = mediaUrl(src);
  React.useEffect(() => {
    setFailed(false);
  }, [href]);
  if (!href || failed) {
    return (
      <div className={`bg-slate-100 flex items-center justify-center text-slate-400 ${className}`} aria-hidden>
        <span className="text-lg">📷</span>
      </div>
    );
  }
  return <img src={href} alt={alt} className={className} onError={() => setFailed(true)} />;
}

// ─── Rating ───────────────────────────────────────────────────────────────────
export function RatingStars({ value, count, showCount = true }: { value: number; count?: number; showCount?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      <span className="text-sm font-semibold text-slate-800">{value}</span>
      {showCount && count !== undefined && (
        <span className="text-xs text-slate-500">({count})</span>
      )}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function ProviderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-xl" />
        <Skeleton className="h-8 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, action, actionLabel }: { title: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display font-700 text-lg text-slate-900" style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700 }}>{title}</h2>
      {action && actionLabel && (
        <button onClick={action} className="text-sm text-brand font-medium hover:text-brand-dark transition-colors">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex gap-1 bg-brand-soft p-1 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${active === tab ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FetchBanner({ error, onRetry, loading }: { error?: string; onRetry?: () => void; loading?: boolean }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p>{error}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={loading}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-slate-800 text-lg mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h3>
      <p className="text-slate-500 text-sm max-w-xs mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? "bg-brand" : i === current - 1 ? "bg-brand flex-1" : "bg-blue-100"}`}
          style={{ width: i === current - 1 ? undefined : "24px", flex: i === current - 1 ? 1 : undefined }}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1 whitespace-nowrap">{current}/{total}</span>
    </div>
  );
}

// ─── Verified Badge ───────────────────────────────────────────────────────────
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Verified
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon,
  color = "sky",
  change,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "sky" | "emerald" | "amber" | "violet";
  change?: string;
}) {
  const colors = {
    sky: "bg-brand-soft text-brand",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`p-2 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
        {change && <p className="text-xs text-emerald-600 font-medium mt-0.5">{change}</p>}
      </div>
    </Card>
  );
}
