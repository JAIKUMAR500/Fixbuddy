import React, { useState } from "react";
import { Search, ArrowRight, MapPin } from "lucide-react";
import { View } from "../../types";
import { Card, Badge, RatingStars, VerifiedBadge, Button, Avatar } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import type { JobRequest, Provider, ServiceCategory } from "../../api/client";

export default function CustomerHome({ navigate }: { navigate: (v: View) => void }) {
  const { user, setRequestData, setSelectedProvider } = useApp();
  const { data } = useFetch<{ requests: JobRequest[] }>("/requests");
  const { data: catData } = useFetch<{ categories: ServiceCategory[] }>("/categories");
  const { data: providerData } = useFetch<{ providers: Provider[] }>("/providers");
  const [search, setSearch] = useState("");
  const activeRequest = data?.requests.find((request) =>
    ["matching", "open", "requested", "accepted", "scheduled", "in_progress"].includes(request.status)
  );
  const cats = catData?.categories || [];
  const nearby = providerData?.providers || [];

  const goFind = () => {
    setRequestData({ description: search });
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
          <MapPin className="w-3 h-3" /> {user?.area || user?.city || "Coimbatore"}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-3 px-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goFind()}
            placeholder="AC is not cooling, need a plumber tomorrow..."
            className="flex-1 bg-transparent outline-none text-slate-800"
          />
        </div>
        <Button onClick={goFind} className="sm:w-auto">
          Find Help <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {activeRequest && (
        <Card className="flex items-center justify-between gap-3 bg-navy text-white border-navy">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase">Active request</p>
            <p className="font-semibold">{activeRequest.category}</p>
            <p className="text-slate-300 text-xs">{activeRequest.status} · {activeRequest.scheduledLabel || activeRequest.timing}</p>
          </div>
          <Button onClick={() => navigate("request-status")}>Track</Button>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Browse Services</h2>
          <button onClick={() => navigate("create-request")} className="text-sm text-brand font-medium">See all</button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {cats.slice(0, 6).map((cat) => (
            <button
              key={cat._id}
              onClick={() => { setRequestData({ category: cat.name, description: cat.name }); navigate("create-request"); }}
              className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-brand hover:shadow-sm text-center"
            >
              <span className="text-2xl block mb-2">{cat.icon}</span>
              <span className="text-xs font-semibold text-slate-700">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Workers near you</h2>
        </div>
        <div className="space-y-3">
          {nearby.slice(0, 4).map((p) => (
            <Card key={p.id} className="hover:border-brand cursor-pointer" onClick={() => { setSelectedProvider(p); navigate("provider-details"); }}>
              <div className="flex gap-4">
                <Avatar src={p.avatar} name={p.name} size="lg" className="rounded-2xl" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.category} · {p.experience}</p>
                    </div>
                    {p.verified && <VerifiedBadge />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <RatingStars value={p.rating} count={p.reviews} />
                    <span>{p.price}</span>
                    <Badge variant={p.available ? "success" : "neutral"}>{p.available ? "Available" : "Busy"}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="outline">View Profile</Button>
              </div>
            </Card>
          ))}
          {!nearby.length && <p className="text-sm text-slate-500">No workers nearby yet.</p>}
        </div>
      </div>
    </div>
  );
}
