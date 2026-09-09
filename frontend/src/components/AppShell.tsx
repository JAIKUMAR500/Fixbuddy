import React from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  ClipboardList,
  DollarSign,
  Flag,
  FolderTree,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  KeyRound,
  Heart,
  LifeBuoy,
} from "lucide-react";
import { View } from "../types";
import { Avatar } from "./ui";
import type { AppUser } from "../api/client";
import { isBusiness, isSeeker, roleLabel } from "../api/roles";
import { displayName } from "../api/display";
import RoleGlyph from "./RoleGlyph";
import { useLang } from "../i18n/LangContext";
import { AuthAPI } from "../api/client";
import { useApp } from "../api/AppContext";

type Variant = "customer" | "worker" | "business" | "admin";

function itemsFor(variant: Variant, t: (k: string) => string): { icon: typeof Home; label: string; view: View }[] {
  if (variant === "customer") {
    return [
      { icon: Home, label: t("nav.home"), view: "customer-home" },
      { icon: Search, label: t("nav.find"), view: "create-request" },
      { icon: ClipboardList, label: t("nav.requests"), view: "my-requests" },
      { icon: Calendar, label: t("nav.bookings"), view: "customer-bookings" },
      { icon: MessageSquare, label: t("nav.messages"), view: "customer-messages" },
      { icon: Sparkles, label: t("nav.ai"), view: "ai-recommend" },
      { icon: Star, label: t("nav.reviews"), view: "customer-reviews" },
      { icon: Heart, label: t("nav.saved"), view: "customer-favorites" },
      { icon: Wallet, label: t("nav.wallet"), view: "customer-wallet" },
      { icon: KeyRound, label: t("nav.license"), view: "customer-license" },
      { icon: LifeBuoy, label: t("nav.support"), view: "customer-support" },
      { icon: User, label: t("nav.profile"), view: "customer-profile" },
      { icon: Settings, label: t("nav.settings"), view: "customer-settings" },
    ];
  }
  if (variant === "worker") {
    return [
      { icon: LayoutDashboard, label: t("nav.dashboard"), view: "business-dashboard" },
      { icon: Wrench, label: t("nav.myJobs"), view: "my-jobs" },
      { icon: Briefcase, label: t("nav.available"), view: "work-requests" },
      { icon: FolderTree, label: t("nav.services"), view: "provider-services" },
      { icon: Sparkles, label: t("nav.ai"), view: "ai-recommend" },
      { icon: DollarSign, label: t("nav.earnings"), view: "earnings" },
      { icon: Calendar, label: t("nav.schedule"), view: "business-calendar" },
      { icon: MessageSquare, label: t("nav.messages"), view: "business-messages" },
      { icon: Star, label: t("nav.reviews"), view: "reviews" },
      { icon: User, label: t("nav.profile"), view: "business-profile" },
      { icon: Wallet, label: t("nav.wallet"), view: "worker-wallet" },
      { icon: KeyRound, label: t("nav.license"), view: "worker-license" },
      { icon: Settings, label: t("nav.settings"), view: "provider-settings" },
    ];
  }
  if (variant === "business") {
    return [
      { icon: LayoutDashboard, label: t("nav.dashboard"), view: "business-dashboard" },
      { icon: Search, label: t("nav.postJob"), view: "create-request" },
      { icon: Briefcase, label: t("nav.myJobs"), view: "my-jobs" },
      { icon: FolderTree, label: t("nav.services"), view: "provider-services" },
      { icon: Sparkles, label: t("nav.ai"), view: "ai-recommend" },
      { icon: Calendar, label: t("nav.schedule"), view: "business-calendar" },
      { icon: DollarSign, label: t("nav.earnings"), view: "earnings" },
      { icon: MessageSquare, label: t("nav.messages"), view: "business-messages" },
      { icon: Star, label: t("nav.reviews"), view: "reviews" },
      { icon: LayoutDashboard, label: t("nav.analytics"), view: "business-analytics" },
      { icon: Wallet, label: t("nav.wallet"), view: "business-wallet" },
      { icon: Users, label: t("nav.team"), view: "business-team" },
      { icon: KeyRound, label: t("nav.license"), view: "business-license" },
      { icon: User, label: t("nav.profile"), view: "business-profile" },
      { icon: Settings, label: t("nav.settings"), view: "provider-settings" },
    ];
  }
  return [
    { icon: LayoutDashboard, label: "Dashboard", view: "admin" },
    { icon: Users, label: "Customers", view: "admin-customers" },
    { icon: Briefcase, label: "Providers", view: "admin-providers" },
    { icon: Wrench, label: "Workers", view: "admin-workers" },
    { icon: ShieldCheck, label: "Verification", view: "admin-verification" },
    { icon: FolderTree, label: "Categories", view: "admin-categories" },
    { icon: Wrench, label: "Services", view: "admin-services" },
    { icon: ClipboardList, label: "Service Requests", view: "admin-requests" },
    { icon: Calendar, label: "Jobs / Bookings", view: "admin-jobs" },
    { icon: Flag, label: "Complaints", view: "admin-complaints" },
    { icon: Star, label: "Reviews", view: "admin-reviews" },
    { icon: Bell, label: "Notifications", view: "admin-notifications" },
    { icon: Wallet, label: "Transactions", view: "admin-transactions" },
    { icon: LayoutDashboard, label: "Analytics", view: "admin-analytics" },
    { icon: KeyRound, label: "Licenses", view: "admin-licenses" },
    { icon: Users, label: "Admin Users", view: "admin-users" },
    { icon: ClipboardList, label: "Audit Logs", view: "admin-audit" },
    { icon: Settings, label: "Settings", view: "admin-settings" },
  ];
}

function notifView(variant: Variant): View {
  if (variant === "customer") return "customer-notifications";
  if (variant === "admin") return "admin-notifications";
  return "business-notifications";
}

export default function AppShell({
  variant,
  navigate,
  currentView,
  user,
  onLogout,
  children,
}: {
  variant: Variant;
  navigate: (v: View) => void;
  currentView: View;
  user?: AppUser | null;
  onLogout?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { t, lang, setLang } = useLang();
  const { setUser } = useApp();
  const items = itemsFor(variant, t);
  const shown = displayName(user);
  const title =
    variant === "admin" ? "Super Admin" : variant === "worker" ? "Worker" : variant === "business" ? "Business" : "Customer";

  return (
    <div className="min-h-screen bg-canvas flex">
      <aside className="hidden lg:flex w-64 bg-navy text-slate-300 flex-col h-screen sticky top-0">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-white/10">
          <RoleGlyph role={user?.role} className="w-5 h-5" boxClassName="w-9 h-9 bg-white text-brand" />
          <div>
            <p className="text-white font-bold text-sm font-display">FixBuddy</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{title}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto thin-scrollbar">
          {items.map(({ icon: Icon, label, view }) => (
            <button
              key={label}
              onClick={() => navigate(view)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base ${currentView === view ? "bg-brand text-white" : "hover:bg-navy-soft"
                }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/10 flex-shrink-0">
              <Avatar src={user?.avatar} name={shown} size="lg" className="rounded-2xl w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{shown}</p>
              <p className="text-[11px] text-slate-400 truncate font-mono">{user?.userCode || roleLabel(user?.role)}</p>
              {user?.license && user.role !== "admin" && (
                <p className="text-[10px] text-emerald-300">{user.license.remainingDays}d license</p>
              )}
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-300">
            <LogOut className="w-4 h-4" /> {t("nav.signOut")}
          </button>
          <div className="flex gap-1 mt-3">
            {(["en", "ta"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l);
                  if (user) void AuthAPI.updateMe({ lang: l }).then((d) => setUser(d.user)).catch(() => {});
                }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold ${lang === l ? "bg-brand text-white" : "bg-white/10 text-slate-300"}`}
              >
                {l === "en" ? "EN" : "TA"}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative z-10 w-64 bg-navy text-slate-300 flex flex-col h-full">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <span className="text-white font-bold">FixBuddy</span>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {items.map(({ icon: Icon, label, view }) => (
                <button
                  key={label}
                  onClick={() => { navigate(view); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base ${currentView === view ? "bg-brand text-white" : "hover:bg-navy-soft"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/10 flex-shrink-0">
                  <Avatar src={user?.avatar} name={shown} size="md" className="rounded-2xl w-full h-full" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{shown}</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono">{user?.userCode || roleLabel(user?.role)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); onLogout?.(); }}
                className="w-full min-h-11 flex items-center justify-center gap-2 text-sm font-semibold text-red-300 bg-white/5 hover:bg-red-500/20 rounded-xl"
              >
                <LogOut className="w-4 h-4" /> {t("nav.signOut")}
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center gap-3">
          <button className="lg:hidden p-3 rounded-xl hover:bg-slate-100 min-w-11 min-h-11" onClick={() => setOpen(true)}>
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 bg-canvas rounded-xl px-3 py-2 border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search FixBuddy..." />
          </div>
          {variant === "customer" && (
            <p className="hidden sm:block text-xs text-slate-500 font-mono">{user?.userCode} · {user?.city || "Your city"}</p>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden p-3 rounded-xl hover:bg-red-50 min-w-11 min-h-11"
              aria-label={t("nav.signOut")}
            >
              <LogOut className="w-6 h-6 text-slate-600" />
            </button>
            <button onClick={() => navigate(notifView(variant))} className="relative p-3 rounded-xl hover:bg-brand-soft min-w-11 min-h-11">
              <Bell className="w-6 h-6 text-slate-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand rounded-full" />
            </button>
            <button
              onClick={() => navigate(variant === "customer" ? "customer-profile" : variant === "admin" ? "admin-settings" : "business-profile")}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50"
            >
              <div className="w-11 h-11 rounded-2xl overflow-hidden border border-slate-200 bg-sky-50">
                <Avatar src={user?.avatar} name={shown} size="md" className="rounded-2xl w-full h-full" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-800">{shown.split(" ")[0]}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">{children}</main>
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex">
          {items.slice(0, 5).map(({ icon: Icon, label, view }) => (
            <button
              key={label}
              onClick={() => navigate(view)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs min-h-[64px] ${currentView === view ? "text-brand" : "text-slate-400"}`}
            >
              <Icon className="w-6 h-6" />
              {label.split(" ")[0]}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function shellVariant(user?: AppUser | null): Variant {
  if (user?.role === "admin") return "admin";
  if (isSeeker(user?.role)) return "worker";
  if (isBusiness(user?.role)) return "business";
  return "customer";
}
