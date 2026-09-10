import React, { useMemo, useState } from "react";
import { TrendingUp, DollarSign } from "lucide-react";
import { View } from "../../types";
import { Card, StatCard, EmptyState } from "../../components/ui";
import { useFetch } from "../../api/AppContext";
import type { JobRequest } from "../../api/client";

export default function Earnings({ navigate }: { navigate: (v: View) => void }) {
  const { data: statsData } = useFetch<{ stats: Record<string, number> }>("/stats");
  const { data, loading } = useFetch<{ requests: JobRequest[] }>("/requests");
  const stats = statsData?.stats || {};
  const jobs = (data?.requests || []).filter((r) => ["completed", "reviewed", "in_progress", "accepted", "scheduled"].includes(r.status));
  const paid = (data?.requests || []).filter((r) => r.paymentStatus === "collected" || ["payment_collected", "customer_completed", "reviewed"].includes(r.status));
  const pending = jobs.filter((r) => !["completed", "reviewed", "cancelled", "declined"].includes(r.status));
  const total = paid.reduce((s, r) => s + (r.estimatedAmount || 0), 0);
  const pendingAmt = pending.reduce((s, r) => s + (r.estimatedAmount || 0), 0);
  const avg = paid.length ? Math.round(total / paid.length) : 0;

  const months = useMemo(() => {
    const map = new Map<string, number>();
    paid.forEach((r) => {
      const d = new Date(r.scheduledAt || r.createdAt || Date.now());
      const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      map.set(key, (map.get(key) || 0) + (r.estimatedAmount || 0));
    });
    return [...map.entries()].map(([month, amount]) => ({ month, amount }));
  }, [paid]);
  const max = Math.max(1, ...months.map((m) => m.amount));

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Earnings</h1>
        <p className="text-slate-500 text-sm">From your live completed jobs</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Earned" value={`₹${(stats.earnings ?? total).toLocaleString("en-IN")}`} icon={<DollarSign className="w-5 h-5" />} color="sky" />
        <StatCard label="Today" value={`₹${(stats.todayEarnings ?? 0).toLocaleString("en-IN")}`} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatCard label="Avg per Job" value={`₹${avg}`} icon={<DollarSign className="w-5 h-5" />} color="amber" />
        <StatCard label="Pending" value={`₹${pendingAmt.toLocaleString("en-IN")}`} icon={<DollarSign className="w-5 h-5" />} color="violet" />
      </div>

      <Card padding="lg">
        <h3 className="font-semibold text-slate-900 mb-5 text-sm">Monthly Revenue</h3>
        {months.length === 0 ? (
          <p className="text-sm text-slate-500">No completed payouts yet.</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {months.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col-reverse" style={{ height: "100px" }}>
                  <div className="w-full rounded-t-lg bg-sky-500" style={{ height: `${(m.amount / max) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md">
        <h3 className="font-semibold text-slate-900 mb-4 text-sm">Recent Jobs</h3>
        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {!loading && jobs.length === 0 && <EmptyState icon="₹" title="No earnings yet" description="Completed jobs will show amounts here." />}
        <div className="space-y-3">
          {jobs.slice(0, 12).map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2 border-b border-sky-50 last:border-0 cursor-pointer" onClick={() => navigate("job-details")}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${["completed", "reviewed"].includes(t.status) ? "bg-emerald-50" : "bg-amber-50"}`}>
                <DollarSign className={`w-4 h-4 ${["completed", "reviewed"].includes(t.status) ? "text-emerald-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.category}</p>
                <p className="text-xs text-slate-500">{t.customer?.name || t.provider?.name || t.area} · {t.scheduledLabel || t.timing}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{t.estimatedAmount ? `₹${t.estimatedAmount}` : "—"}</p>
                <span className={`text-xs font-medium ${["completed", "reviewed"].includes(t.status) ? "text-emerald-600" : "text-amber-600"}`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
