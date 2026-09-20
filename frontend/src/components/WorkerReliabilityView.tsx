import React, { useState, useEffect } from "react";
import { Award, CheckCircle2, Clock, Users, Wrench, Star, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { WorkerAPI, WorkerReliability } from "../api/client";

interface Props {
  workerId?: string;
}

export default function WorkerReliabilityView({ workerId }: Props) {
  const [data, setData] = useState<WorkerReliability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    void WorkerAPI.reliabilityProfile(workerId)
      .then((res) => {
        if (!mounted) return;
        setData(res);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load reliability data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [workerId]);

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
        <p className="text-xs text-slate-500">Calculating factual reliability metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
        {error || "Unable to display reliability profile."}
      </div>
    );
  }

  const { factualMetrics, milestones } = data;

  return (
    <div className="space-y-4">
      {/* Metrics Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Factual Reliability Scorecard</h3>
              <p className="text-xs text-slate-500">Calculated strictly from completed platform orders</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Verified Record
          </span>
        </div>

        {/* 4 Key Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{factualMetrics.completedJobs}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {factualMetrics.completionRate}% completion rate
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">On-Time Arrival</p>
            <p className="text-2xl font-black text-brand mt-1">{factualMetrics.onTimeArrivalRate}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Prompt job arrival</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Repeat Clients</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{factualMetrics.repeatCustomerCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Rebooked by customers</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rating</p>
            <p className="text-2xl font-black text-slate-900 mt-1 flex items-center justify-center gap-1">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              {factualMetrics.averageRating > 0 ? factualMetrics.averageRating.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{factualMetrics.totalRatedJobs} reviews</p>
          </div>
        </div>

        {/* Verification badges & low cancellation note */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1.5 font-medium">
            <Wrench className="w-4 h-4 text-brand" />
            {factualMetrics.verifiedSkillsCount} verified trade skill(s) on passport
          </span>
          <span className="font-semibold text-slate-700">
            {factualMetrics.cancelledJobs} cancellation(s)
          </span>
        </div>
      </div>

      {/* Real Milestones Progression */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Worker Milestones & Badges</h3>
            <p className="text-xs text-slate-500">Milestones unlocked automatically via genuine customer jobs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {milestones.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.threshold) * 100));
            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border transition-all ${
                  m.achieved
                    ? "bg-amber-50/40 border-amber-200 shadow-sm"
                    : "bg-slate-50/60 border-slate-200/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{m.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                    </div>
                  </div>
                  {m.achieved && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                      Unlocked
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>Progress</span>
                    <span className="font-bold text-slate-700">
                      {m.progress} / {m.threshold}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.achieved ? "bg-amber-500" : "bg-brand"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
