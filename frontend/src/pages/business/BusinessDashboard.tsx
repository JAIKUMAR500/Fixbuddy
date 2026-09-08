import React from "react";
import {
  Briefcase,
  Wrench,
  Calendar,
  DollarSign,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Plus,
} from "lucide-react";
import { View } from "../../types";
import { StatCard, Card, SectionHeader, Badge, RatingStars, Button } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { isSeeker } from "../../api/roles";
import type { JobRequest } from "../../api/client";

export default function BusinessDashboard({ navigate }: { navigate: (v: View) => void }) {
  const { user } = useApp();
  const worker = isSeeker(user?.role);
  const { data: statsData } = useFetch<{ stats: Record<string, number> }>("/stats");
  const { data: inbox } = useFetch<{ requests: JobRequest[] }>(worker ? "/requests?inbox=true" : "/requests");
  const stats = statsData?.stats || {};
  const list = inbox?.requests || [];
  const incoming = list.filter((r) => ["open", "requested", "matching"].includes(r.status));
  const active = list.filter((r) => ["accepted", "scheduled", "in_progress"].includes(r.status));

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-sky-100 flex-shrink-0 ring-2 ring-sky-100">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-sky-700">
                {(user?.provider?.businessName || user?.name || "U").slice(0, 1)}
              </div>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-sm">Welcome back,</p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {user?.provider?.businessName || user?.name || "Account"}
            </h1>
            <p className="text-xs text-brand mt-1">{worker ? "Job seeker · pick up live work" : "Job creator · post work for workers"}</p>
          </div>
        </div>
        {!worker && (
          <Button onClick={() => navigate("create-request")}>
            <Plus className="w-4 h-4" /> Post a Job
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={worker ? "New Jobs" : "Open Posts"}
          value={stats.newRequests ?? incoming.length}
          icon={<Briefcase className="w-5 h-5" />}
          color="sky"
        />
        <StatCard
          label="Active Jobs"
          value={stats.inProgress ?? active.length}
          icon={<Wrench className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcoming ?? 0}
          icon={<Calendar className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Completed"
          value={stats.completed ?? user?.provider?.completedJobs ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="violet"
        />
      </div>

      <Card padding="md" className="bg-brand border-brand">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sky-200 text-xs font-medium">{worker ? "This Month's Earnings" : "Spend on posted jobs"}</p>
            <p className="font-display text-3xl font-black text-white mt-0.5">₹{stats.earnings ?? stats.spend ?? 0}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
        <button onClick={() => navigate("earnings")} className="mt-3 text-xs font-semibold text-sky-200 flex items-center gap-1 hover:text-white transition-colors">
          View details <ArrowRight className="w-3 h-3" />
        </button>
      </Card>

      <div>
        <SectionHeader
          title={worker ? "Available jobs" : "Jobs you posted"}
          actionLabel="View all"
          action={() => navigate(worker ? "work-requests" : "my-jobs")}
        />
        <div className="space-y-3">
          {(worker ? incoming : list).slice(0, 4).map((req) => (
            <Card key={req.id} padding="md" className="hover:border-sky-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate(worker ? "work-requests" : "my-jobs")}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm line-clamp-1">{req.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{req.category} · {req.postedByRole || "customer"}</p>
                </div>
                <Badge variant="info" className="flex-shrink-0">{req.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>📍 {req.area || req.city}</span>
                <span>🕐 {req.scheduledLabel || req.timing}</span>
                <span>💰 ₹{req.estimatedAmount}</span>
              </div>
            </Card>
          ))}
          {!list.length && <p className="text-sm text-slate-500">{worker ? "No open jobs right now." : "Post a job to hire workers."}</p>}
        </div>
      </div>

      {worker && (
        <div>
          <SectionHeader title="Upcoming Jobs" actionLabel="My Jobs" action={() => navigate("my-jobs")} />
          <div className="space-y-2">
            {active.map((job) => (
              <div key={job.id} className="bg-white rounded-xl border border-sky-100 px-4 py-3 flex items-center gap-3" onClick={() => navigate("my-jobs")}>
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{job.category}</p>
                  <p className="text-xs text-slate-500">{job.customer?.name || "Customer"} · {job.area || job.city}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {worker && (
        <Card padding="md" className="bg-amber-50 border-amber-200">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-black text-4xl text-amber-600">{user?.provider?.ratingAvg || 0}</p>
              <RatingStars value={user?.provider?.ratingAvg || 0} showCount={false} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">Your rating</p>
              <p className="text-xs text-slate-600 mt-0.5">Based on {user?.provider?.ratingCount || 0} reviews</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
