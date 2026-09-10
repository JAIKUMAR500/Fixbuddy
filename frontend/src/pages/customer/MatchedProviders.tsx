import React, { useState } from "react";
import { ArrowLeft, MapPin, Clock, CheckCircle, SlidersHorizontal } from "lucide-react";
import { View } from "../../types";
import { Button, Card, RatingStars, VerifiedBadge, Avatar } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { RequestAPI } from "../../api/client";
import type { JobRequest, Provider } from "../../api/client";
import { isBusiness } from "../../api/roles";

interface Props {
  navigate: (v: View) => void;
  onSelectProvider: (p: Provider) => void;
}

export default function MatchedProviders({ navigate, onSelectProvider }: Props) {
  const [sortBy, setSortBy] = useState("rating");
  const { activeRequestId, user } = useApp();
  const [actionError, setActionError] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { data, loading, error, reload } = useFetch<{ request: JobRequest }>(
    activeRequestId ? `/requests/${activeRequestId}?matches=true` : null
  );
  const matchedProviders = data?.request.matches || [];
  const request = data?.request;
  const invited = new Set(request?.invitedProviderIds || []);
  const taken = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed", "payment_collected", "customer_completed", "reviewed"].includes(request?.status || "");

  const sorted = [...matchedProviders]
    .filter((p) => !verifiedOnly || p.verified)
    .sort((a, b) => {
      if (a.available !== b.available) return Number(b.available) - Number(a.available);
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "price") return String(a.price).localeCompare(String(b.price));
      if (sortBy === "response") return String(a.responseTime).localeCompare(String(b.responseTime));
      const aDistance = Number.parseFloat(a.distance);
      const bDistance = Number.parseFloat(b.distance);
      return (Number.isFinite(aDistance) ? aDistance : Infinity) - (Number.isFinite(bDistance) ? bDistance : Infinity);
    });

  const requestService = async (providerId: string) => {
    if (!activeRequestId) {
      setActionError("Create a request first so we can connect you with this provider.");
      return;
    }
    if (taken) {
      setActionError("A worker already accepted this job.");
      return;
    }
    setAssigningId(providerId);
    setActionError("");
    try {
      await RequestAPI.assign(activeRequestId, providerId);
      navigate("request-status");
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to request this provider");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="sticky top-0 z-10 bg-white border-b border-sky-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(isBusiness(user?.role) ? "business-dashboard" : "customer-home")} className="p-2 rounded-xl hover:bg-sky-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-900 text-sm">Matched Providers</h1>
            <p className="text-xs text-slate-500">{[request?.category, request?.area || request?.city].filter(Boolean).join(" · ") || "Live matches for your request"}</p>
          </div>
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${verifiedOnly ? "bg-sky-600 text-white border-sky-600" : "text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100"}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> {verifiedOnly ? "Verified only" : "Filter"}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              {taken ? "A worker already accepted this job" : "Request as many workers as you want"}
            </p>
            <p className="text-xs text-emerald-600">
              {taken
                ? "Only the first worker who accepted can do this job."
                : invited.size
                  ? `${invited.size} worker${invited.size === 1 ? "" : "s"} asked. The first one to accept takes the job.`
                  : `${sorted.length} providers matched. The first worker who accepts gets the job.`}
            </p>
          </div>
          {invited.size > 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate("request-status")}>
              Status
            </Button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {["rating", "distance", "price", "response"].map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${sortBy === s ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-sky-200 hover:border-sky-400"}`}
            >
              {s === "rating" ? "Top Rated" : s === "distance" ? "Nearest" : s === "price" ? "Lowest Price" : "Fastest Response"}
            </button>
          ))}
        </div>

        {error && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
        {actionError && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{actionError}</Card>}
        {!activeRequestId && <Card className="text-center text-sm text-slate-600">Create a request first to see live matches.</Card>}
        {!loading && !error && activeRequestId && sorted.length === 0 && (
          <Card className="text-center text-sm text-slate-600">No providers matched this request yet. Try posting it publicly.</Card>
        )}
        {sorted.map((p) => (
          <Card key={p.id} padding="md" className="hover:border-sky-300 hover:shadow-md transition-all cursor-pointer">
            <div className="flex gap-4">
              <div className="relative flex-shrink-0">
                <Avatar src={p.avatar || p.photos?.[0]} name={p.name} size="lg" className="rounded-2xl" />
                {!p.available && (
                  <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-500">Busy</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                      {p.verified && <VerifiedBadge />}
                    </div>
                    <p className="text-xs text-slate-500">{p.category}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${p.available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.available ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mb-2 line-clamp-2">{p.description}</p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
                  <RatingStars value={p.rating} count={p.reviews} />
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.distance}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{p.responseTime}</span>
                  <span>·</span>
                  <span>{p.completedJobs} jobs</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sky-700 font-bold text-sm">{p.price}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { onSelectProvider(p); navigate("provider-details"); }}
                    >
                      View Details
                    </Button>
                    <Button
                      variant={invited.has(p.id) ? "secondary" : "primary"}
                      size="sm"
                      disabled={!p.available || taken || invited.has(p.id)}
                      onClick={() => { onSelectProvider(p); void requestService(p.id); }}
                      loading={assigningId === p.id}
                    >
                      {taken ? "Taken" : invited.has(p.id) ? "Requested" : "Request"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}

        <Card padding="md" className="bg-sky-50 border-sky-200 text-center">
          <p className="text-sm font-semibold text-slate-800 mb-1">Don't see the right fit?</p>
          <p className="text-xs text-slate-500 mb-3">Post a public request and let providers contact you.</p>
          <Button variant="secondary" size="sm" onClick={() => navigate("create-request")}>
            Post a Request
          </Button>
        </Card>
      </div>
    </div>
  );
}
