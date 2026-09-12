import React from "react";
import { Copy, KeyRound, LifeBuoy, Heart, Clock, Wallet, ShieldCheck, CalendarDays, BadgeCheck } from "lucide-react";
import { Badge, Button, Card } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { mediaUrl, type JobRequest, type Provider } from "../../api/client";
import { roleLabel } from "../../api/roles";
import SupportContact from "../../components/SupportContact";
import AnalyticsDashboard from "./AnalyticsDashboard";

function copy(text: string) {
  void navigator.clipboard?.writeText(text);
}

export function UserIdCard() {
  const { user } = useApp();
  const lic = user?.license;
  return (
    <Card className="bg-navy text-white overflow-hidden relative animate-slide-up">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand/30 blur-2xl animate-pulse-slow" />
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 bg-white/10 flex-shrink-0">
          {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
              {(user?.name || "U").slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-400">Login User ID</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-black font-display tracking-wide">{user?.userCode || user?.id}</p>
            <button onClick={() => copy(user?.userCode || user?.id || "")} className="p-1.5 rounded-lg hover:bg-white/10">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">{user?.email} · {roleLabel(user?.role)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1">
          <span>{lic?.plan || "no plan"} license</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {lic?.remainingDays ?? 0} days left</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-700" style={{ width: `${lic?.percent ?? 0}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {lic?.status === "active" ? `Active until ${lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString("en-IN") : "—"}` : "Ask Super Admin to grant a login license."}
        </p>
      </div>
    </Card>
  );
}

export function LicensePage() {
  const { user } = useApp();
  const lic = user?.license;
  const status = lic?.status || "none";
  const remaining = lic?.remainingDays ?? 0;
  const pct = Math.min(100, Math.max(0, lic?.percent ?? 0));
  const active = status === "active";
  const expiring = active && remaining <= 7;
  const expires = lic?.expiresAt ? new Date(lic.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const starts = lic?.startsAt ? new Date(lic.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const plan = (lic?.plan || "none").replace(/_/g, " ");

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto space-y-5 pb-24 animate-slide-up">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Account access</p>
        <h1 className="text-2xl font-bold font-display text-slate-900">Login license</h1>
        <p className="text-sm text-slate-500 mt-1">This pass is issued by Super Admin. It controls how long you can sign in to FixBuddy.</p>
      </div>

      <div className="rounded-3xl bg-navy text-white overflow-hidden shadow-sm">
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">FixBuddy access pass</p>
            <p className="font-display text-xl font-bold mt-1">{user?.provider?.businessName || user?.name}</p>
            <p className="text-xs text-slate-300 mt-0.5">{roleLabel(user?.role)} · {user?.email}</p>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            active ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"
          }`}>
            {active ? "Active" : status}
          </span>
        </div>
        <div className="px-5 pb-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 bg-white/10 flex-shrink-0">
            {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold">
                {(user?.name || "U").slice(0, 1)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">User ID</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-bold truncate">{user?.userCode || "—"}</p>
              <button type="button" onClick={() => copy(user?.userCode || "")} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Copy user ID">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white/5 px-5 py-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-300 capitalize">{plan} plan</span>
            <span className="inline-flex items-center gap-1 text-sky-200">
              <Clock className="w-3.5 h-3.5" /> {remaining} day{remaining === 1 ? "" : "s"} left
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${expiring ? "bg-amber-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Valid until {expires}</p>
        </div>
      </div>

      {expiring && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Your license expires soon. Ask Super Admin to renew so you can keep signing in.
        </p>
      )}
      {!active && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          This account cannot sign in until Super Admin grants an active license.
        </p>
      )}

      <Card padding="md">
        <p className="font-semibold text-slate-900 mb-3">License details</p>
        <div className="grid grid-cols-2 gap-3">
          <Detail icon={<KeyRound className="w-4 h-4" />} label="License key" value={lic?.key || "—"} copy={lic?.key} mono />
          <Detail icon={<BadgeCheck className="w-4 h-4" />} label="Plan" value={plan} />
          <Detail icon={<CalendarDays className="w-4 h-4" />} label="Issued" value={starts} />
          <Detail icon={<Clock className="w-4 h-4" />} label="Duration" value={`${lic?.days || 0} days`} />
          <Detail icon={<ShieldCheck className="w-4 h-4" />} label="Status" value={status} />
          <Detail icon={<CalendarDays className="w-4 h-4" />} label="Expires" value={expires} />
        </div>
      </Card>

      <p className="text-xs text-slate-400 text-center">Quote your user ID when you contact support. License keys are assigned by Super Admin only.</p>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  copy: copyValue,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copy?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 min-w-0">
      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mb-1">
        {icon} {label}
      </p>
      <div className="flex items-center gap-1">
        <p className={`text-sm font-semibold text-slate-900 truncate ${mono ? "font-mono text-xs" : "capitalize"}`}>{value}</p>
        {copyValue && (
          <button type="button" onClick={() => copy(copyValue)} className="p-1 rounded hover:bg-white text-slate-400" aria-label={`Copy ${label}`}>
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function LiveWallet() {
  const { user } = useApp();
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 animate-slide-up">
      <h1 className="text-2xl font-bold font-display">Wallet</h1>
      <UserIdCard />
      <Card className="bg-brand text-white">
        <p className="text-blue-100 text-sm inline-flex items-center gap-2"><Wallet className="w-4 h-4" /> Available balance</p>
        <p className="text-4xl font-black font-display mt-1">₹{(user?.walletBalance || 0).toLocaleString("en-IN")}</p>
        <p className="text-xs text-blue-100 mt-2">Tied to user ID {user?.userCode}</p>
      </Card>
    </div>
  );
}

export function FavoritesPage() {
  const { data } = useFetch<{ providers: Provider[] }>("/providers");
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-5 animate-slide-up">
      <h1 className="text-2xl font-bold font-display">Saved workers</h1>
      <p className="text-sm text-slate-500">Workers near you, ready to save for next time.</p>
      {(data?.providers || []).slice(0, 6).map((p) => (
        <Card key={p.id} className="flex items-center gap-3">
          <Heart className="w-4 h-4 text-brand" />
          <div className="flex-1">
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-slate-500">{p.category} · {p.location}</p>
          </div>
          <Badge variant={p.available ? "success" : "neutral"}>{p.available ? "Available" : "Busy"}</Badge>
        </Card>
      ))}
    </div>
  );
}

export function SupportPage() {
  const { user } = useApp();
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5 animate-slide-up">
      <h1 className="text-2xl font-bold font-display">Help & support</h1>
      <Card>
        <LifeBuoy className="w-8 h-8 text-brand mb-2" />
        <p className="font-semibold">Contact support</p>
        <p className="text-sm text-slate-500 mt-1">Quote your user ID <span className="font-mono text-slate-800">{user?.userCode}</span> when you contact support.</p>
        <SupportContact
          variant="stack"
          className="mt-4 inline-flex flex-col rounded-xl bg-brand text-white px-5 py-3 hover:bg-brand-dark"
        />
      </Card>
    </div>
  );
}

export function TeamPage() {
  return null;
}

function lastDayKeys(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function LiveAnalytics() {
  const { data, error } = useFetch<{ requests: JobRequest[] }>("/requests");
  const { data: statsData } = useFetch<{ stats: Record<string, number> }>("/stats");
  const rows = data?.requests || [];
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const byDay: Record<string, { jobs: number; revenue: number }> = {};
  rows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    const cat = r.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const city = r.city || r.area || "Unknown";
    byCity[city] = (byCity[city] || 0) + 1;
    const day = r.createdAt ? String(r.createdAt).slice(0, 10) : "";
    if (day) {
      if (!byDay[day]) byDay[day] = { jobs: 0, revenue: 0 };
      byDay[day].jobs += 1;
      byDay[day].revenue += r.estimatedAmount || r.workerQuote || 0;
    }
  });
  const days = lastDayKeys(14).map((id) => {
    const v = byDay[id] || { jobs: 0, revenue: 0 };
    return { _id: id, jobs: v.jobs, n: v.jobs, revenue: v.revenue, users: 0 };
  });
  const activity = [...rows]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      text: `${r.category || "Job"} · ${String(r.status || "").replace(/_/g, " ")}`,
      at: r.createdAt,
    }));

  return (
    <div className="p-4 lg:p-6">
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <AnalyticsDashboard
        title="Analytics"
        revenue={Number(statsData?.stats?.earnings ?? statsData?.stats?.spend ?? rows.reduce((s, r) => s + (r.estimatedAmount || 0), 0))}
        revenueHint="From your jobs"
        newUsers={rows.length}
        usersLabel="Jobs"
        usersHint="Jobs in this account"
        active={(byStatus.accepted || 0) + (byStatus.scheduled || 0) + (byStatus.on_the_way || 0) + (byStatus.arrived || 0) + (byStatus.otp_verified || 0) + (byStatus.in_progress || 0)}
        activeHint="Live work"
        cancelled={(byStatus.cancelled || 0) + (byStatus.declined || 0)}
        cancelledHint="Cancelled + declined"
        byDay={days}
        byCategory={Object.entries(byCategory).map(([_id, n]) => ({ _id, n })).sort((a, b) => b.n - a.n)}
        byCity={Object.entries(byCity).map(([_id, n]) => ({ _id, n })).sort((a, b) => b.n - a.n)}
        byStatus={byStatus}
        activity={activity}
      />
    </div>
  );
}

export { KeyRound };
