import React, { useState } from "react";
import { MapPin, Calendar } from "lucide-react";
import { View } from "../../types";
import { StatusBadge, EmptyState, Card, Skeleton } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import type { JobRequest } from "../../api/client";

const ALL_TABS = ["All", "Accepted", "Upcoming", "In Progress", "Completed", "Cancelled"];

function matchesTab(status: string, tab: string) {
  if (tab === "All") return true;
  if (tab === "Accepted") return status === "accepted";
  if (tab === "Upcoming") return status === "scheduled";
  if (tab === "In Progress") return status === "in_progress";
  if (tab === "Completed") return status === "completed" || status === "reviewed";
  if (tab === "Cancelled") return status === "cancelled" || status === "declined";
  return true;
}

export default function MyJobs({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, user } = useApp();
  const [tab, setTab] = useState("All");
  const { data, loading, error } = useFetch<{ requests: JobRequest[] }>("/requests");
  const filtered = (data?.requests || []).filter((j) => matchesTab(j.status, tab));

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>My Jobs</h1>
        <p className="text-slate-500 text-sm">All your work in one place</p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
        {ALL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${tab === t ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-sky-200 hover:border-sky-400"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <Skeleton className="h-24 w-full" />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && filtered.length === 0 ? (
        <EmptyState icon="🔧" title={`No ${tab} Jobs`} description={user?.role === "worker" ? "Pick up work from Available Jobs." : "Post a job for workers to accept."} actionLabel={user?.role === "worker" ? "Available Jobs" : "Post a Job"} onAction={() => navigate(user?.role === "worker" ? "work-requests" : "create-request")} />
      ) : (
        <div className="space-y-3 animate-slide-up">
          {filtered.map((job) => (
            <Card
              key={job.id}
              padding="md"
              className="hover:border-sky-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => {
                setActiveRequestId(job.id);
                navigate("job-details");
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{job.category}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{job.code} · {job.customer?.name || "Customer"}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.area || job.city}</span>
                <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{job.scheduledLabel || job.timing}</span>
                <span>₹{job.estimatedAmount}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
