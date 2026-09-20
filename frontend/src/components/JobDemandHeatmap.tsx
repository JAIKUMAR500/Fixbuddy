import React, { useState, useEffect } from "react";
import { Flame, MapPin, RefreshCw, Filter, ShieldAlert, Sparkles, Navigation, Layers } from "lucide-react";
import { WorkerAPI, JobDemandCluster } from "../api/client";
import { Button } from "./ui";

interface Props {
  workerLat?: number | null;
  workerLng?: number | null;
}

export default function JobDemandHeatmap({ workerLat, workerLng }: Props) {
  const [clusters, setClusters] = useState<JobDemandCluster[]>([]);
  const [totalOpenJobs, setTotalOpenJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);

  const fetchHeatmap = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await WorkerAPI.demandHeatmap(
        workerLat != null && workerLng != null ? { lat: workerLat, lng: workerLng } : undefined
      );
      setClusters(res.clusters || []);
      setTotalOpenJobs(res.totalActiveDemands || 0);

      // Extract unique categories across all clusters
      const catSet = new Set<string>();
      (res.clusters || []).forEach((c) => {
        Object.keys(c.categories || {}).forEach((k) => catSet.add(k));
      });
      setCategories(Array.from(catSet));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load demand heatmap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHeatmap();
  }, [workerLat, workerLng]);

  // Safe helper to extract properties across backend payload variations
  const getClusterInfo = (c: JobDemandCluster) => {
    const raw = c as any;
    const centerLat = Number(c.center?.lat ?? raw.lat ?? 0);
    const centerLng = Number(c.center?.lng ?? raw.lng ?? 0);
    const demandCount = Number(c.activeDemandCount ?? raw.count ?? 0);
    const emCount = Number(c.priorityCounts?.emergency ?? raw.emergencyCount ?? 0);
    const urgCount = Number(c.priorityCounts?.urgent ?? raw.urgentCount ?? 0);
    const normCount = Number(c.priorityCounts?.normal ?? Math.max(0, demandCount - emCount - urgCount));
    const cats: Record<string, number> = c.categories || {};
    const topCat = c.topCategory || raw.topCategories?.[0]?.name || Object.keys(cats)[0] || "General Services";
    const approxRadius = c.approxRadiusKm ?? 2;
    const cid = c.clusterId || `${centerLat}_${centerLng}`;
    return {
      cid,
      centerLat,
      centerLng,
      demandCount,
      emCount,
      urgCount,
      normCount,
      cats,
      topCat,
      approxRadius,
    };
  };

  // Filter clusters
  const filteredClusters = clusters.filter((c) => {
    const info = getClusterInfo(c);
    if (selectedCategory !== "all" && !info.cats[selectedCategory]) {
      return false;
    }
    if (selectedPriority === "emergency" && info.emCount === 0) {
      return false;
    }
    if (selectedPriority === "urgent" && info.urgCount === 0 && info.emCount === 0) {
      return false;
    }
    return true;
  });

  const emergencyCount = clusters.reduce((sum, c) => sum + getClusterInfo(c).emCount, 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Local Demand Heatmap</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Live Grid
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated ~2km service demand clusters. Privacy-first, zero customer addresses revealed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHeatmap}
            disabled={loading}
            className="text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
        <div className="p-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Requests</p>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">{totalOpenJobs}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Demand Hotspots</p>
          <p className="text-lg font-extrabold text-amber-600 mt-0.5">{clusters.length}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Emergency Leads</p>
          <p className={`text-lg font-extrabold mt-0.5 ${emergencyCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {emergencyCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-8 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setSelectedPriority("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedPriority === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Leads
          </button>
          <button
            type="button"
            onClick={() => setSelectedPriority("urgent")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedPriority === "urgent"
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            ⚡ Urgent+
          </button>
          <button
            type="button"
            onClick={() => setSelectedPriority("emergency")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedPriority === "emergency"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            🚨 Emergency
          </button>
        </div>
      </div>

      {/* Cluster Cards */}
      <div className="p-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-3">
            {error}
          </div>
        )}

        {filteredClusters.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No active demand hotspots found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Demand updates automatically as customers in your service region request maintenance and repair jobs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredClusters.map((cluster) => {
              const info = getClusterInfo(cluster);
              const isHot = info.demandCount >= 4;
              const hasEmergency = info.emCount > 0;
              const hasUrgent = info.urgCount > 0;

              return (
                <div
                  key={info.cid}
                  className={`p-4 rounded-2xl border transition-all hover:shadow-md ${
                    hasEmergency
                      ? "border-rose-200 bg-rose-50/30"
                      : isHot
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {hasEmergency ? "🚨" : isHot ? "🔥" : "📍"}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {info.topCat} Zone
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isHot
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {info.demandCount} jobs
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          Approx ~{info.centerLat.toFixed(2)}, {info.centerLng.toFixed(2)} (within ~{info.approxRadius}km)
                        </p>
                      </div>
                    </div>

                    <a
                      href={`https://www.google.com/maps?q=${info.centerLat},${info.centerLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-slate-100 transition-colors"
                      title="Open approximate area in Google Maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Priority and Categories Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-slate-100/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {hasEmergency && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {info.emCount} Emergency
                        </span>
                      )}
                      {hasUrgent && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          {info.urgCount} Urgent
                        </span>
                      )}
                      {info.normCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                          {info.normCount} Normal
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {Object.entries(info.cats).map(([cat, count]) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-white border border-slate-200 text-slate-700 font-medium"
                        >
                          {cat} <strong className="text-brand">×{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
