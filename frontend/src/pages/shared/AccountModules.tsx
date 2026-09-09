import React from "react";
import { Copy, KeyRound, LifeBuoy, Heart, Clock, Wallet } from "lucide-react";
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
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display">Login license</h1>
        <p className="text-sm text-slate-500">Admin decides how long your account can sign in.</p>
      </div>
      <UserIdCard />
      <Card className="grid sm:grid-cols-2 gap-4 text-sm">
        <p><span className="text-slate-400">License key</span><br /><span className="font-mono">{lic?.key || "—"}</span></p>
        <p><span className="text-slate-400">Plan</span><br />{lic?.plan}</p>
        <p><span className="text-slate-400">Duration</span><br />{lic?.days} days</p>
        <p><span className="text-slate-400">Status</span><br /><Badge variant={lic?.status === "active" ? "success" : "warning"}>{lic?.status}</Badge></p>
      </Card>
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
        active={(byStatus.accepted || 0) + (byStatus.scheduled || 0) + (byStatus.in_progress || 0)}
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
