import React, { useEffect, useState } from "react";
import { MapPin, Clock, DollarSign, CheckCircle, X, Phone, MessageSquare, Play, Flag, ChevronRight, Navigation, Wallet } from "lucide-react";
import { View } from "../../types";
import { Card, EmptyState, Skeleton } from "../../components/ui";
import { JobProgress, jobPrimaryAction } from "../../components/JobProgress";
import { ChatAPI, RequestAPI, mediaUrl, type JobRequest } from "../../api/client";
import { useApp, useFetch } from "../../api/AppContext";
import { jobError } from "../../api/jobLock";

const OPEN = ["open", "requested", "matching"];
const ACTIVE = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"];

export default function WorkRequests({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, user } = useApp();
  const { data, loading, error, reload } = useFetch<{ requests: JobRequest[] }>("/requests?inbox=true");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const requests = data?.requests || [];
  const current = requests.filter(
    (r) => ACTIVE.includes(r.status) && r.providerId === user?.id
  );
  const available = requests
    .filter((r) => OPEN.includes(r.status) && !r.providerId)
    .sort((a, b) => Number(b.invitedProviderIds?.includes(user?.id || "")) - Number(a.invitedProviderIds?.includes(user?.id || "")));
  const worker = user?.role === "worker";
  const mustFinish = worker && current.length > 0;
  const job = current[0];

  const act = async (id: string, kind: "accept" | "decline" | "start" | "complete" | "enroute" | "arrive" | "collect") => {
    setBusy(id);
    setActionError("");
    try {
      const loc = async () => {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }));
          return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          return {};
        }
      };
      if (kind === "accept") await RequestAPI.accept(id);
      else if (kind === "decline") await RequestAPI.decline(id);
      else if (kind === "enroute") await RequestAPI.enroute(id, await loc());
      else if (kind === "arrive") await RequestAPI.arrive(id, await loc());
      else if (kind === "start") await RequestAPI.start(id);
      else if (kind === "collect") await RequestAPI.collectPayment(id);
      else await RequestAPI.complete(id);
      if (kind === "accept") {
        setActiveRequestId(id);
        navigate("active-job");
        return;
      }
      reload();
    } catch (e) {
      setActionError(jobError(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!job?.id || !["accepted", "on_the_way", "arrived", "otp_verified", "in_progress"].includes(job.status)) return;
    if (!navigator.geolocation) return;
    const last = { t: 0 };
    const watch = navigator.geolocation.watchPosition((pos) => {
      const now = Date.now();
      if (now - last.t < 15000) return;
      last.t = now;
      void RequestAPI.pingLocation(job.id, pos.coords.latitude, pos.coords.longitude).catch(() => {});
    });
    return () => navigator.geolocation.clearWatch(watch);
  }, [job?.id, job?.status]);

  const openChat = async (id: string) => {
    setBusy(id);
    setActionError("");
    try {
      await ChatAPI.open(id, user?.id);
      setActiveRequestId(id);
      navigate("business-messages");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Work order</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {mustFinish ? "Active job" : "Available jobs"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {mustFinish
            ? "You're handling an active job. Complete or cancel this job before accepting another."
            : "Accept → On the way → Arrived → OTP → Start → Complete. First to accept gets the job."}
        </p>
      </div>

      {actionError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{actionError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-48 w-full" />}

      {!loading && current.length === 0 && available.length === 0 && (
        <EmptyState
          icon="📋"
          title="No active work order"
          description="When a customer or business requests you, accept here. First accept wins."
        />
      )}

      {job && (
        <button
          type="button"
          onClick={() => {
            setActiveRequestId(job.id);
            navigate("active-job");
          }}
          className="w-full rounded-2xl bg-slate-900 text-white px-4 py-4 text-left"
        >
          <p className="text-[11px] uppercase tracking-wider text-sky-200">You have an active job</p>
          <p className="font-semibold mt-1">{job.category} · {job.status.replace(/_/g, " ")}</p>
          <p className="text-sm text-sky-200 mt-1">Open active job</p>
        </button>
      )}

      {mustFinish && available.length > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          {available.length} more job{available.length === 1 ? "" : "s"} nearby. You're handling an active job — complete or cancel it before accepting another.
        </p>
      )}

      {!mustFinish && (
        <button
          type="button"
          onClick={() => navigate("worker-next-jobs")}
          className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
        >
          <p className="font-semibold text-amber-900">🎯 Find your next job</p>
          <p className="text-xs text-amber-800 mt-0.5">Nearby work ranked by skill, distance and today's remaining target.</p>
        </button>
      )}

      {!mustFinish && available.length > 0 && (
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Queue · {available.length}</p>
          {available.map((req) => (
            <OfferCard
              key={req.id}
              req={req}
              invited={req.invitedProviderIds?.includes(user?.id || "") || false}
              busy={busy === req.id}
              onAccept={() => void act(req.id, "accept")}
              onDecline={() => void act(req.id, "decline")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveJobCard({
  req,
  busy,
  onAction,
  onCall,
  onChat,
  onDetails,
  onSafety,
}: {
  req: JobRequest;
  busy: boolean;
  onAction: (kind: "enroute" | "arrive" | "start" | "complete" | "collect") => void;
  onCall: () => void;
  onChat: () => void;
  onDetails: () => void;
  onSafety: () => void;
}) {
  const action = jobPrimaryAction(req.status);
  return (
    <Card padding="none" className="overflow-hidden border-slate-200 shadow-sm">
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Work order {req.code}</p>
          <p className="text-white font-semibold mt-0.5">{req.category}</p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
          {req.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="px-5 pt-5 pb-2">
        <JobProgress status={req.status} />
      </div>
      <div className="px-5 pb-5 space-y-4">
        <p className="text-slate-800 font-medium leading-snug">{req.description}</p>
        <Meta req={req} />
        {action === "enroute" && (
          <button disabled={busy} onClick={() => onAction("enroute")} className="w-full min-h-14 rounded-2xl bg-sky-600 text-white text-lg font-semibold hover:bg-sky-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <Navigation className="w-5 h-5" /> On the way
          </button>
        )}
        {action === "arrive" && (
          <button disabled={busy} onClick={() => onAction("arrive")} className="w-full min-h-14 rounded-2xl bg-sky-600 text-white text-lg font-semibold hover:bg-sky-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <MapPin className="w-5 h-5" /> I've arrived
          </button>
        )}
        {action === "otp" && (
          <button type="button" onClick={onDetails} className="w-full min-h-14 rounded-2xl bg-amber-500 text-white text-lg font-semibold hover:bg-amber-600 flex items-center justify-center gap-2">
            Enter customer OTP
          </button>
        )}
        {action === "start" && (
          <button disabled={busy} onClick={() => onAction("start")} className="w-full min-h-14 rounded-2xl bg-sky-600 text-white text-lg font-semibold hover:bg-sky-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <Play className="w-5 h-5" /> Start work
          </button>
        )}
        {action === "complete" && (
          <button disabled={busy} onClick={() => onAction("complete")} className="w-full min-h-14 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <Flag className="w-5 h-5" /> Complete work
          </button>
        )}
        {action === "collect" && (
          <button disabled={busy} onClick={() => onAction("collect")} className="w-full min-h-14 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <Wallet className="w-5 h-5" /> Confirm payment ₹{req.workerQuote || req.estimatedAmount || 0}
          </button>
        )}
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={onCall} className="min-h-12 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5">
            <Phone className="w-4 h-4" /> Call
          </button>
          <button type="button" disabled={busy} onClick={onChat} className="min-h-12 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-50">
            <MessageSquare className="w-4 h-4" /> Message
          </button>
          <button type="button" onClick={onDetails} className="min-h-12 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5">
            Track <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onSafety} className="min-h-12 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 flex items-center justify-center gap-1.5">
            <Flag className="w-4 h-4" /> Safety
          </button>
        </div>
      </div>
    </Card>
  );
}

function OfferCard({
  req,
  invited,
  busy,
  onAccept,
  onDecline,
}: {
  req: JobRequest;
  invited: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card padding="none" className={`overflow-hidden ${invited ? "border-amber-300" : "border-slate-200"}`}>
      {invited && (
        <div className="bg-amber-50 px-5 py-2.5 text-xs font-semibold text-amber-800 border-b border-amber-100">
          Customer requested you · accept first to take this job
        </div>
      )}
      <div className="p-5 space-y-4">
        <JobProgress status="open" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">{req.category}</p>
          <p className="font-semibold text-slate-900 mt-1 leading-snug">{req.description}</p>
          <p className="text-xs text-slate-500 mt-1">{req.customer?.name || "Customer"} · {req.code}</p>
        </div>
        {req.photos?.length ? (
          <div className="grid grid-cols-3 gap-2">
            {req.photos.slice(0, 3).map((src) => (
              <img key={src} src={mediaUrl(src)} alt="" className="h-20 w-full rounded-xl object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.opacity = "0.25"; }} />
            ))}
          </div>
        ) : null}
        <Meta req={req} />
        <button
          disabled={busy}
          onClick={onAccept}
          className="w-full min-h-14 rounded-2xl bg-sky-600 text-white text-lg font-semibold hover:bg-sky-700 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
        >
          <CheckCircle className="w-5 h-5" /> Accept job
        </button>
        <button
          disabled={busy}
          onClick={onDecline}
          className="w-full min-h-11 text-sm font-semibold text-slate-500 hover:text-red-600 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <X className="w-4 h-4" /> Decline
        </button>
      </div>
    </Card>
  );
}

function Meta({ req }: { req: JobRequest }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-slate-400 font-medium mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
        <p className="font-semibold text-slate-800 truncate">{req.area || req.city}</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-slate-400 font-medium mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> When</p>
        <p className="font-semibold text-slate-800 truncate">{req.scheduledLabel || req.timing}</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-slate-400 font-medium mb-0.5 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Amount</p>
        <p className="font-semibold text-slate-800">₹{req.estimatedAmount || 0}</p>
      </div>
    </div>
  );
}
