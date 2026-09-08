import React from "react";
import { Briefcase, CheckCircle2, MapPin, UserPlus, Wallet } from "lucide-react";
import { Card } from "../../components/ui";
import { ComboChart, DonutChart, MetricCard, dayLabel } from "../../components/Charts";

export type AnalyticsDay = { _id?: string; n?: number; jobs?: number; revenue?: number; users?: number };
export type NamedCount = { _id?: string | null; n: number };

type Props = {
  title?: string;
  revenue: number;
  revenueHint?: string;
  newUsers: number;
  usersLabel?: string;
  usersHint?: string;
  active: number;
  activeHint?: string;
  cancelled: number;
  cancelledHint?: string;
  byDay: AnalyticsDay[];
  byCategory: NamedCount[];
  byCity: NamedCount[];
  byStatus: Record<string, number>;
  activity: { id: string; text: string; at?: string }[];
};

function money(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function ago(at?: string) {
  if (!at) return "";
  const ms = Date.now() - new Date(at).getTime();
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} day ago`;
}

export default function AnalyticsDashboard({
  title = "Analytics",
  revenue,
  revenueHint,
  newUsers,
  usersLabel = "New Users",
  usersHint,
  active,
  activeHint,
  cancelled,
  cancelledHint,
  byDay,
  byCategory,
  byCity,
  byStatus,
  activity,
}: Props) {
  const bars = byDay.map((d) => ({ label: dayLabel(d._id), value: d.revenue || 0 }));
  const line = byDay.map((d) => ({ label: dayLabel(d._id), value: d.jobs ?? d.n ?? 0 }));
  const open = (byStatus.open || 0) + (byStatus.requested || 0) + (byStatus.matching || 0);
  const progress = (byStatus.accepted || 0) + (byStatus.scheduled || 0) + (byStatus.in_progress || 0);
  const done = (byStatus.completed || 0) + (byStatus.reviewed || 0);
  const totalJobs = open + progress + done || 1;
  const livePct = Math.round((progress / totalJobs) * 100);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        {title ? <h1 className="text-2xl font-bold font-display text-slate-900">{title}</h1> : null}
        <p className={`text-sm text-slate-500 ${title ? "" : "-mt-1"}`}>Live FixBuddy numbers — not sample data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Revenue" value={money(revenue)} hint={revenueHint} up />
        <MetricCard label={usersLabel} value={newUsers} hint={usersHint} up accent="emerald" />
        <MetricCard label="Active Jobs" value={active} hint={activeHint} up />
        <MetricCard label="Cancelled" value={cancelled} hint={cancelledHint} up={false} accent="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" padding="lg">
          <h2 className="font-semibold text-slate-900">Revenue analytics</h2>
          <p className="text-xs text-slate-400 mb-3">Job value (bars) and jobs posted (line)</p>
          <ComboChart bars={bars} line={line} barLabel="Revenue" lineLabel="Jobs" />
        </Card>
        <Card padding="lg">
          <h2 className="font-semibold text-slate-900 mb-4">Top services</h2>
          <div className="space-y-3">
            {byCategory.slice(0, 5).map((c) => (
              <div key={String(c._id || "none")} className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c._id || "Uncategorized"}</p>
                  <p className="text-xs text-slate-400">{c.n} jobs</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{c.n}</p>
              </div>
            ))}
            {!byCategory.length && <p className="text-sm text-slate-500">No jobs yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card padding="lg">
          <h2 className="font-semibold text-slate-900 mb-4">Recent activity</h2>
          <div className="space-y-4">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex gap-3">
                <span className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm text-slate-800">{a.text}</p>
                  <p className="text-xs text-slate-400">{ago(a.at)}</p>
                </div>
              </div>
            ))}
            {!activity.length && <p className="text-sm text-slate-500">No activity yet.</p>}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="font-semibold text-slate-900 mb-1">Job status</h2>
          <p className="text-xs text-slate-400 mb-3">Active vs waiting vs done</p>
          <DonutChart
            center={`${livePct}%`}
            segments={[
              { label: "Active", value: progress, color: "#0056D2" },
              { label: "Open", value: open, color: "#38BDF8" },
              { label: "Done", value: done, color: "#0B1B3A" },
            ]}
          />
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <div>
              <p className="font-bold text-brand text-lg">{open}</p>
              <p className="text-slate-500">Open</p>
            </div>
            <div>
              <p className="font-bold text-emerald-600 text-lg">{progress}</p>
              <p className="text-slate-500">In progress</p>
            </div>
            <div>
              <p className="font-bold text-navy text-lg">{done}</p>
              <p className="text-slate-500">Resolved</p>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="font-semibold text-slate-900 mb-4">Cities</h2>
          <div className="space-y-3">
            {byCity.slice(0, 6).map((c) => (
              <div key={String(c._id || "none")} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm text-slate-700 min-w-0">
                  <MapPin className="w-4 h-4 text-brand flex-shrink-0" />
                  <span className="truncate">{c._id || "Unknown"}</span>
                </span>
                <span className="text-sm font-semibold">{c.n}</span>
              </div>
            ))}
            {!byCity.length && (
              <p className="text-sm text-slate-500 inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Cities appear when users save a location.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-4 inline-flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> Counts are live from your database.
          </p>
        </Card>
      </div>
    </div>
  );
}
