import React from "react";
import {
  Home,
  FileText,
  MessageSquare,
  User,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  Briefcase,
  Calendar,
  Users,
  Star,
  DollarSign,
  LogOut,
  Wrench,
} from "lucide-react";
import { View } from "../types";
import { Avatar } from "./ui";
import type { AppUser } from "../api/client";

// ─── Customer Top Navbar ──────────────────────────────────────────────────────
export function CustomerNavbar({
  navigate,
  currentView,
  user,
}: {
  navigate: (v: View) => void;
  currentView: View;
  user?: AppUser | null;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-sky-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate("customer-home")} className="flex items-center gap-2">
          <span className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>F</span>
          <span className="font-display font-bold text-slate-900 text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("customer-notifications")}
            className="relative p-2 rounded-xl hover:bg-sky-50 transition-colors text-slate-600"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full" />
          </button>
          <button onClick={() => navigate("customer-profile")} className="rounded-full overflow-hidden">
            <Avatar src={user?.avatar} name={user?.name || "You"} size="sm" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Customer Bottom Navigation ───────────────────────────────────────────────
export function CustomerBottomNav({
  navigate,
  currentView,
}: {
  navigate: (v: View) => void;
  currentView: View;
}) {
  const items = [
    { icon: Home, label: "Home", view: "customer-home" as View },
    { icon: FileText, label: "Requests", view: "my-requests" as View },
    { icon: MessageSquare, label: "Messages", view: "customer-messages" as View },
    { icon: User, label: "Profile", view: "customer-profile" as View },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-sky-100 pb-safe">
      <div className="max-w-5xl mx-auto flex">
        {items.map(({ icon: Icon, label, view }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${active ? "text-sky-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-sky-600" : ""}`} />
              <span className="text-xs font-medium">{label}</span>
              {active && <span className="w-1 h-1 bg-sky-600 rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Business Sidebar ─────────────────────────────────────────────────────────
export function BusinessSidebar({
  navigate,
  currentView,
  onClose,
  user,
  onLogout,
}: {
  navigate: (v: View) => void;
  currentView: View;
  onClose?: () => void;
  user?: AppUser | null;
  onLogout?: () => void;
}) {
  const isWorker = user?.role === "worker";
  const items = isWorker
    ? [
        { icon: LayoutDashboard, label: "Dashboard", view: "business-dashboard" as View },
        { icon: Briefcase, label: "Available Jobs", view: "work-requests" as View },
        { icon: Wrench, label: "My Jobs", view: "my-jobs" as View },
        { icon: Calendar, label: "Schedule", view: "business-calendar" as View },
        { icon: MessageSquare, label: "Messages", view: "business-messages" as View },
        { icon: Star, label: "Reviews", view: "reviews" as View },
        { icon: DollarSign, label: "Earnings", view: "earnings" as View },
        { icon: User, label: "Profile", view: "business-profile" as View },
        { icon: Bell, label: "Notifications", view: "business-notifications" as View },
      ]
    : [
        { icon: LayoutDashboard, label: "Dashboard", view: "business-dashboard" as View },
        { icon: FileText, label: "Post a Job", view: "create-request" as View },
        { icon: Wrench, label: "My Jobs", view: "my-jobs" as View },
        { icon: Calendar, label: "Schedule", view: "business-calendar" as View },
        { icon: MessageSquare, label: "Messages", view: "business-messages" as View },
        { icon: Star, label: "Reviews", view: "reviews" as View },
        { icon: DollarSign, label: "Spend", view: "earnings" as View },
        { icon: User, label: "Business Profile", view: "business-profile" as View },
        { icon: Bell, label: "Notifications", view: "business-notifications" as View },
      ];

  return (
    <aside className="w-60 bg-white border-r border-sky-100 flex flex-col h-full">
      <div className="px-5 h-16 flex items-center justify-between border-b border-sky-100 flex-shrink-0">
        <button onClick={() => navigate("business-dashboard")} className="flex items-center gap-2">
          <span className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">F</span>
          <span className="font-display font-bold text-slate-900 text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto thin-scrollbar py-4 px-3">
        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {isWorker ? "Worker Menu" : "Business Menu"}
        </p>
        {items.map(({ icon: Icon, label, view }) => {
          const active = currentView === view;
          return (
            <button
              key={label}
              onClick={() => { navigate(view); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5 ${
                active
                  ? "bg-sky-600 text-white"
                  : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
      <div className="border-t border-sky-100 p-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            src={user?.avatar}
            name={user?.provider?.businessName || user?.name || "Business"}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.provider?.businessName || user?.name || "Business"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.provider?.category || "Provider"}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 text-sm text-slate-500 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── Business Mobile Bottom Nav ───────────────────────────────────────────────
export function BusinessBottomNav({
  navigate,
  currentView,
}: {
  navigate: (v: View) => void;
  currentView: View;
}) {
  const items = [
    { icon: LayoutDashboard, label: "Dashboard", view: "business-dashboard" as View },
    { icon: Briefcase, label: "Requests", view: "work-requests" as View },
    { icon: Wrench, label: "Jobs", view: "my-jobs" as View },
    { icon: MessageSquare, label: "Messages", view: "business-messages" as View },
    { icon: User, label: "Profile", view: "business-profile" as View },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-sky-100 lg:hidden">
      <div className="flex">
        {items.map(({ icon: Icon, label, view }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${active ? "text-sky-600" : "text-slate-400"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Business Header (mobile) ─────────────────────────────────────────────────
export function BusinessTopbar({
  navigate,
  currentView,
  onMenuClick,
}: {
  navigate: (v: View) => void;
  currentView: View;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-sky-100 lg:hidden">
      <div className="px-4 h-14 flex items-center justify-between">
        <button onClick={onMenuClick} className="p-2 rounded-xl hover:bg-sky-50">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <span className="font-display font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
        <button
          onClick={() => navigate("business-notifications")}
          className="relative p-2 rounded-xl hover:bg-sky-50"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
