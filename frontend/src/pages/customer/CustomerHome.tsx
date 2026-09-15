import React, { useMemo, useState } from "react";
import { Search, ArrowRight, MapPin, SlidersHorizontal } from "lucide-react";
import { View } from "../../types";
import { Card, Badge, RatingStars, VerifiedBadge, Button, Avatar, EmptyState, FetchBanner } from "../../components/ui";
import CategoryIcon from "../../components/CategoryIcon";
import { useApp, useFetch } from "../../api/AppContext";
import { mediaUrl, type JobRequest, type Provider, type ServiceCategory } from "../../api/client";
import { isPendingStatus, isPaidStatus, statusLabel } from "../../api/jobLock";

export default function CustomerHome({ navigate }: { navigate: (v: View) => void }) {
  const { user, setRequestData, setSelectedProvider, setActiveRequestId, currentJob, jobFocusLocked, openRequest } = useApp();
  const { data, loading, error, reload } = useFetch<{ requests: JobRequest[] }>("/requests");
  const { data: catData, error: catError, reload: reloadCats } = useFetch<{ categories: ServiceCategory[] }>("/categories");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [maxKm, setMaxKm] = useState("40");
  const [minRating, setMinRating] = useState("0");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const lat = user?.lat;
  const lng = user?.lng;
  const nearbyQs = lat != null && lng != null
    ? `?lat=${lat}&lng=${lng}&available=${availableOnly}&maxKm=${maxKm}&minRating=${minRating}${category ? `&category=${encodeURIComponent(category)}` : ""}`
    : `?available=${availableOnly}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
  const { data: providerData, error: providerError, reload: reloadProviders } = useFetch<{ providers: Provider[] }>(`/providers${nearbyQs}`);
  const requests = data?.requests || [];
  const pending = requests.filter((request) => isPendingStatus(request.status) && request.id !== currentJob?.id);
  const completed = requests.filter((request) => isPaidStatus(request.status)).slice(0, 3);
  const cats = catData?.categories || [];
  const nearby = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (providerData?.providers || []).filter((p) => {
      if (availableOnly && !p.available) return false;
      if (category && !String(p.category || "").toLowerCase().includes(category.toLowerCase())) return false;
      if (Number(minRating) && (p.rating || 0) < Number(minRating)) return false;
      const dist = Number.parseFloat(p.distance);
      if (maxKm && Number.isFinite(dist) && dist > Number(maxKm)) return false;
      if (maxPrice) {
        const price = Number.parseFloat(String(p.price || "").replace(/[^\d.]/g, ""));
        if (Number.isFinite(price) && price > Number(maxPrice)) return false;
      }
      if (!q) return true;
      return [p.name, p.category, p.location, ...(p.services || []).map((s) => (typeof s === "string" ? s : s.name))].join(" ").toLowerCase().includes(q);
    });
  }, [providerData, search, category, availableOnly, maxKm, minRating, maxPrice]);

  const goFind = () => {
    if (jobFocusLocked) {
      navigate("active-job");
      return;
    }
    setRequestData({ description: search, category: category || undefined });
    navigate("create-request");
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-slate-500 text-sm">Need a service?</p>
        <h1 className="text-2xl lg:text-3xl font-black font-display text-slate-900">
          What can we help you with today?
        </h1>
        <p className="text-xs text-brand mt-1 inline-flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {user?.area || user?.city || "Using your live location"}
        </p>
      </div>

      <FetchBanner error={error || providerError || catError} onRetry={() => { reload(); reloadProviders(); reloadCats(); }} loading={loading} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-3 px-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goFind()}
            placeholder="Search worker, service, category..."
            className="flex-1 bg-transparent outline-none text-slate-800"
          />
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} className="px-3 min-h-11 text-slate-500">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
        <Button onClick={goFind} className="sm:w-auto">
          Find Help <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      <button type="button" onClick={() => navigate(jobFocusLocked ? "active-job" : "find-crew")} className="text-sm font-semibold text-brand">
        {jobFocusLocked ? "Track Active Job →" : "Need several workers? Find a team →"}
      </button>

      {showFilters && (
        <Card className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs text-slate-500">Distance
            <select value={maxKm} onChange={(e) => setMaxKm(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="20">20 km</option>
              <option value="40">40 km</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Rating
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
              <option value="0">Any</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
              <option value="">All</option>
              {cats.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Price
            <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
              <option value="">Any</option>
              <option value="300">Under ₹300</option>
              <option value="500">Under ₹500</option>
              <option value="700">Under ₹700</option>
              <option value="1500">Under ₹1500</option>
            </select>
          </label>
          <label className="text-xs text-slate-500 flex items-center gap-2 mt-6">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} /> Available only
          </label>
        </Card>
      )}

      {jobFocusLocked && currentJob && (
        <Card className="bg-navy text-white border-navy space-y-2">
          <p className="text-blue-200 text-xs font-semibold uppercase">Current job</p>
          <p className="font-semibold text-lg">{currentJob.category}</p>
          <p className="text-slate-300 text-sm">
            {currentJob.provider?.name || "Worker assigned"} · {statusLabel(currentJob.status)}
            {currentJob.etaMinutes ? ` · ETA ${currentJob.etaMinutes} min` : ""}
          </p>
          <Button onClick={() => { setActiveRequestId(currentJob.id); navigate("active-job"); }}>Track Active Job</Button>
        </Card>
      )}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-slate-900">Other requests</h2>
          {pending.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{r.category}</p>
                <p className="text-xs text-slate-500">{statusLabel(r.status)} · {r.code}</p>
              </div>
          <Button variant="outline" onClick={() => openRequest(r.id, "request-status")}>View</Button>
            </Card>
          ))}
        </div>
      )}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-slate-900">Completed jobs</h2>
          {completed.map((r) => (
            <button key={r.id} type="button" className="w-full text-left text-sm text-slate-600" onClick={() => openRequest(r.id, "request-status")}>
              {r.category} · {r.provider?.name || "Worker"} · ₹{r.workerQuote || r.estimatedAmount || 0}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Browse Services</h2>
          <button onClick={() => navigate(jobFocusLocked ? "active-job" : "create-request")} className="text-sm text-brand font-medium">{jobFocusLocked ? "Track Active Job" : "See all"}</button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {cats.map((cat) => (
            <button
              key={cat._id}
              onClick={() => {
                if (jobFocusLocked) {
                  navigate("active-job");
                  return;
                }
                setRequestData({ category: cat.name, description: cat.name });
                navigate("create-request");
              }}
              className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 hover:border-brand hover:shadow-sm text-center min-h-24"
            >
              <span className="flex justify-center text-brand mb-2">
                <CategoryIcon icon={cat.icon} className="w-7 h-7" />
              </span>
              <span className="text-xs font-semibold text-slate-700 line-clamp-2 leading-tight">{cat.name}</span>
            </button>
          ))}
          <button
            onClick={() => {
              if (jobFocusLocked) {
                navigate("active-job");
                return;
              }
              setRequestData({ category: "Other", description: "" });
              navigate("create-request");
            }}
            className="bg-white border border-dashed border-slate-300 rounded-2xl p-4 hover:border-brand text-center"
          >
            <span className="text-2xl block mb-2">➕</span>
            <span className="text-xs font-semibold text-slate-700">Other</span>
          </button>
        </div>
        {!cats.length && !catError && <p className="text-sm text-slate-500">Categories will appear here once they are published.</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Workers near you</h2>
        </div>
        {lat != null && lng != null && nearby[0] && (
          <p className="text-xs text-slate-500 mb-3">Showing workers near your live location.</p>
        )}
        <div className="space-y-3">
          {nearby.slice(0, 8).map((p) => (
            <Card key={p.id} className="hover:border-brand">
              <div className="flex gap-3">
                <Avatar src={mediaUrl(p.avatar)} name={p.name} size="lg" className="rounded-2xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${p.online || p.available ? "bg-emerald-500" : "bg-slate-300"}`} title={p.online ? "Active" : "Inactive"} />
                      </p>
                      <p className="text-xs text-slate-500">{p.category} · {p.distance} away</p>
                    </div>
                    {p.verified && <VerifiedBadge />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <RatingStars value={p.rating} count={p.reviews} />
                    <span>{p.price}</span>
                    <Badge variant={p.available ? "success" : "neutral"}>{p.available ? "Available" : "Busy"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedProvider(p); navigate(jobFocusLocked ? "active-job" : "provider-details"); }}>View</Button>
                    <Button size="sm" disabled={!p.available || jobFocusLocked} onClick={() => { setSelectedProvider(p); setRequestData({ category: p.category, description: search || p.category }); navigate("create-request"); }}>{jobFocusLocked ? "Busy" : "Request"}</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {!nearby.length && !providerError && <EmptyState icon="📍" title="No nearby workers" description="Allow location and try another category, or post a public request." actionLabel={jobFocusLocked ? "Track Active Job" : "Post a request"} onAction={() => navigate(jobFocusLocked ? "active-job" : "create-request")} />}
        </div>
      </div>
    </div>
  );
}
