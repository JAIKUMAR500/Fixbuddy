import React, { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Clock, Phone, MessageSquare, Star, CheckCircle, ChevronRight } from "lucide-react";
import { View } from "../../types";
import { Button, RatingStars, VerifiedBadge, Card, Tabs, Avatar, EmptyState, SafeImg } from "../../components/ui";
import { ProviderAPI, RequestAPI, ReviewAPI, type Provider, type ReviewsPayload } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { isBusiness } from "../../api/roles";
import { startCall } from "../../api/phone";
import { serviceLabel, servicePrice } from "../../api/display";

interface Props {
  navigate: (v: View) => void;
  provider: Provider | null;
}

export default function ProviderDetails({ navigate, provider }: Props) {
  const { user, activeRequestId, setRequestData } = useApp();
  const [tab, setTab] = useState("About");
  const [p, setP] = useState<Provider | null>(provider);
  const [reviews, setReviews] = useState<ReviewsPayload | null>(null);
  const [busy, setBusy] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [alreadyRequested, setAlreadyRequested] = useState(false);
  const inbox = user?.role === "customer" ? "customer-messages" : "business-messages";
  const back = user?.role === "customer" || isBusiness(user?.role) ? "matched-providers" : "work-requests";
  const taken = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed", "payment_collected", "customer_completed", "reviewed"].includes(requestStatus);
  const callAllowed = taken;

  useEffect(() => {
    setP(provider);
    if (!provider?.id) return;
    void ProviderAPI.get(provider.id)
      .then((d) => setP(d.provider))
      .catch(() => setP(provider));
    void ReviewAPI.list(provider.id)
      .then(setReviews)
      .catch(() => setReviews(null));
  }, [provider]);

  useEffect(() => {
    setRequestStatus("");
    setAlreadyRequested(false);
    if (!activeRequestId) return;
    void RequestAPI.get(activeRequestId)
      .then(({ request }) => {
        setRequestStatus(request.status);
        setAlreadyRequested((request.invitedProviderIds || []).includes(provider?.id || ""));
      })
      .catch(() => setRequestStatus(""));
  }, [activeRequestId, provider?.id]);

  if (!p) {
    return (
      <div className="min-h-screen bg-sky-50 p-6">
        <EmptyState icon="👤" title="No provider selected" description="Go back and pick a worker to see their live profile." actionLabel="Back" onAction={() => navigate(back)} />
      </div>
    );
  }

  const photos = p.photos?.length ? p.photos : p.coverPhoto ? [p.coverPhoto] : [];
  const hours = p.hours ? `${p.hours.from} – ${p.hours.to}` : "Hours not listed";
  const dist = reviews?.distribution || [0, 0, 0, 0, 0];
  const total = dist.reduce((s, n) => s + n, 0) || 1;

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="relative h-48 bg-sky-100 overflow-hidden">
        {p.coverPhoto || photos[0] ? (
          <SafeImg src={p.coverPhoto || photos[0]} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-sky-200 to-sky-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <button
          onClick={() => navigate(back)}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur p-2 rounded-xl shadow"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl shadow-md border border-sky-100 p-5 mb-4">
          <div className="flex gap-4 items-start">
            <Avatar src={p.avatar} name={p.name} size="xl" className="rounded-2xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>{p.name}</h1>
                {p.verified && <VerifiedBadge />}
              </div>
              <p className="text-sm text-slate-500 mb-2">{p.category}</p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <RatingStars value={p.rating} count={p.reviews} />
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.distance}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Responds {p.responseTime}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-sky-50">
            {[
              { label: "Completed Jobs", value: p.completedJobs },
              { label: "Years Exp.", value: p.experience || "—" },
              { label: "Response", value: p.responseTime },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-bold text-sky-700 text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Tabs tabs={["About", "Services", "Reviews", "Photos"]} active={tab} onChange={setTab} className="mb-4" />

        {tab === "About" && (
          <div className="space-y-4 animate-fade-in">
            <Card padding="md">
              <h3 className="font-semibold text-slate-900 mb-2 text-sm">About</h3>
              <p className="text-sm text-slate-600">{p.description || "This provider has not added a description yet."}</p>
            </Card>
            <Card padding="md">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Business Details</h3>
              <div className="space-y-2">
                {[
                  { label: "Location", value: p.location || "—", icon: <MapPin className="w-4 h-4 text-sky-500" /> },
                  { label: "Phone", value: p.phone || "—", icon: <Phone className="w-4 h-4 text-sky-500" /> },
                  { label: "Working Hours", value: hours, icon: <Clock className="w-4 h-4 text-sky-500" /> },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 py-2 border-b border-sky-50 last:border-0">
                    {row.icon}
                    <div>
                      <p className="text-xs text-slate-400">{row.label}</p>
                      {row.label === "Phone" && p.phone ? (
                        <button type="button" disabled={!callAllowed} className="text-sm font-medium text-sky-700 disabled:text-slate-400" onClick={() => startCall(p.phone)}>
                          {row.value}
                        </button>
                      ) : (
                        <p className="text-sm font-medium text-slate-800">{row.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "Services" && (
          <Card padding="md" className="animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Services Offered</h3>
            <div className="space-y-3">
              {(p.services || []).length === 0 && <p className="text-sm text-slate-500">No services listed yet.</p>}
              {(p.services || []).map((s, i) => (
                <div key={`${serviceLabel(s)}-${i}`} className="flex items-center justify-between py-2 border-b border-sky-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-slate-800">{serviceLabel(s)}</span>
                  </div>
                  <span className="text-xs text-slate-500">₹{servicePrice(s, 0) || "—"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "Reviews" && (
          <div className="space-y-3 animate-fade-in">
            <Card padding="md" className="bg-sky-50 border-sky-200">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-black text-4xl text-sky-700" style={{ fontFamily: "Outfit, sans-serif" }}>{reviews?.ratingAvg ?? p.rating}</p>
                  <div className="flex gap-0.5 justify-center my-1">
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(reviews?.ratingAvg ?? p.rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}
                  </div>
                  <p className="text-xs text-slate-500">{reviews?.ratingCount ?? p.reviews} reviews</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-2">{n}</span>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${((dist[n - 1] || 0) / total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            {(reviews?.reviews || []).map((r) => (
              <Card key={r.id} padding="md">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar src={r.avatar} name={r.customer} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.customer}</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                      <span className="text-xs text-slate-400 ml-1">{r.date}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{r.comment}</p>
              </Card>
            ))}
            {!reviews?.reviews?.length && <p className="text-sm text-slate-500 text-center py-4">No reviews yet.</p>}
          </div>
        )}

        {tab === "Photos" && (
          photos.length ? (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              {photos.map((url, i) => (
                <div key={url} className={`rounded-2xl overflow-hidden ${i === 0 ? "col-span-2 h-48" : "h-32"}`}>
                  <SafeImg src={url} alt={`work-${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          ) : (
            <Card className="text-sm text-slate-500 text-center">This provider has not uploaded work photos yet.</Card>
          )
        )}

        <div className="sticky bottom-20 lg:bottom-0 z-20 bg-sky-50/95 backdrop-blur pt-4 pb-6 mt-6">
          <div className="flex gap-3">
            <Button variant="outline" fullWidth size="lg" disabled={!callAllowed} onClick={() => startCall(p.phone)}>
              <Phone className="w-4 h-4" /> Call
            </Button>
            <Button variant="outline" fullWidth size="lg" onClick={() => navigate(inbox)}>
              <MessageSquare className="w-4 h-4" /> Message
            </Button>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={taken || alreadyRequested}
              loading={busy === "assign"}
              onClick={async () => {
                if (activeRequestId) {
                  setBusy("assign");
                  try {
                    await RequestAPI.assign(activeRequestId, p.id);
                    navigate("matched-providers");
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : "Could not request this worker");
                  } finally {
                    setBusy("");
                  }
                  return;
                }
                setRequestData({ category: p.category, description: p.category });
                navigate("create-request");
              }}
            >
              {taken ? "Job taken" : alreadyRequested ? "Requested" : "Request Service"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
