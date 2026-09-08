import React, { useState } from "react";
import { ChevronRight, MapPin, Calendar } from "lucide-react";
import { View } from "../../types";
import { Tabs, StatusBadge, EmptyState, Card } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import type { JobRequest } from "../../api/client";

export default function MyRequests({ navigate }: { navigate: (v: View) => void }) {
  const [tab, setTab] = useState("Active");
  const { setActiveRequestId } = useApp();
  const { data, loading, error } = useFetch<{ requests: JobRequest[] }>("/requests");
  const rows = data?.requests || [];

  const filtered = rows.filter((request) => {
    if (tab === "Active") return ["matching", "open", "requested", "accepted", "in_progress"].includes(request.status);
    if (tab === "Upcoming") return request.status === "scheduled";
    if (tab === "Completed") return ["completed", "reviewed"].includes(request.status);
    if (tab === "Cancelled") return ["cancelled", "declined"].includes(request.status);
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>My Requests</h1>
        <p className="text-slate-500 text-sm">Track all your service requests</p>
      </div>

      <Tabs
        tabs={["Active", "Upcoming", "Completed", "Cancelled"]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {error && <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
      {loading ? (
        <Card className="text-sm text-slate-500">Loading your requests...</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === "Cancelled" ? "🚫" : "📋"}
          title={`No ${tab} Requests`}
          description={tab === "Active" ? "You haven't requested any help yet." : `You have no ${tab.toLowerCase()} requests.`}
          actionLabel={tab === "Active" ? "Find Help" : undefined}
          onAction={tab === "Active" ? () => navigate("customer-home") : undefined}
        />
      ) : (
        <div className="space-y-3 animate-slide-up">
          {filtered.map((r) => (
            <Card
              key={r.id}
              padding="md"
              className="hover:border-sky-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => {
                setActiveRequestId(r.id);
                navigate("request-status");
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{r.category}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{r.provider?.name || "Finding a provider"}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.scheduledLabel || r.timing}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.area || r.city}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-sky-50">
                <span className="font-semibold text-sky-700 text-sm">{r.estimatedAmount ? `₹${r.estimatedAmount}` : "Quote pending"}</span>
                <span className="text-xs text-sky-600 font-medium flex items-center gap-1">
                  View Details <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
