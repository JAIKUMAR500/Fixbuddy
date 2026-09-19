import React, { useCallback, useEffect, useState } from "react";
import {
  Flag,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  Share2,
  Shield,
  Wallet,
} from "lucide-react";
import { View } from "../../types";
import { Button, Card } from "../../components/ui";
import { JobProgress, jobPrimaryAction } from "../../components/JobProgress";
import JobTrackingPanel, { isTrackingStatus } from "../../components/JobTrackingPanel";
import CancelJobPanel from "../../components/CancelJobPanel";
import { ChatAPI, RequestAPI, mediaUrl, uploadImage, type JobRequest } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { isSeeker } from "../../api/roles";
import { Chip } from "@mui/material";
import { canCancelJob, jobError, isEngagedStatus, statusLabel } from "../../api/jobLock";
import { SimulatedMoneyBanner } from "../../components/SimulatedMoney";
import { startCall } from "../../api/phone";
import { jobAmountRupees, formatRupees } from "../../api/money";
import { useLang } from "../../i18n/LangContext";
import { useWorkerGps } from "../../api/useWorkerGps";
import {
  getRealtimeConnectionState,
  subscribeConnection,
  subscribeRealtime,
  type RealtimeConnectionState,
} from "../../api/realtime";

function cacheJob(job: JobRequest) {
  try {
    sessionStorage.setItem(`fb_job_${job.id}`, JSON.stringify(job));
  } catch {
    /* ignore */
  }
}

const TIMELINE = [
  { match: ["matching", "open", "requested"], label: "Request created" },
  { match: ["accepted", "scheduled"], label: "Worker accepted" },
  { match: ["on_the_way"], label: "Worker on the way" },
  { match: ["arrived"], label: "Worker arrived" },
  { match: ["otp_verified"], label: "OTP verified" },
  { match: ["in_progress"], label: "Work in progress" },
  { match: ["completed"], label: "Work completed" },
  { match: ["payment_collected", "customer_completed", "reviewed"], label: "Payment collected" },
];

function stepDone(status: string, match: string[]) {
  const order = TIMELINE.findIndex((t) => t.match.includes(status));
  const here = TIMELINE.findIndex((t) => t.match === match);
  if (status === "cancelled") return false;
  return here >= 0 && order > here;
}

function stepActive(status: string, match: string[]) {
  return match.includes(status);
}

export default function ActiveJob({ navigate }: { navigate: (v: View) => void }) {
  const { user, setActiveRequestId, refreshCurrentJob } = useApp();
  const { t } = useLang();
  const worker = isSeeker(user?.role);
  const [job, setJob] = useState<JobRequest | null>(null);
  const [closedHint, setClosedHint] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [busy, setBusy] = useState("");
  const [otp, setOtp] = useState("");
  const [watchUrl, setWatchUrl] = useState("");
  const [photoStage, setPhotoStage] = useState<"before" | "during" | "after">("before");
  const [liveWorker, setLiveWorker] = useState<{ lat: number; lng: number; at: number } | null>(null);
  const [socketState, setSocketState] = useState<RealtimeConnectionState>(getRealtimeConnectionState());
  const gpsState = useWorkerGps(job?.id, job?.status, worker);

  const load = useCallback(async () => {
    try {
      const focused = await RequestAPI.currentJob();
      const next = focused.request && isEngagedStatus(focused.request.status) ? focused.request : null;
      if (next) {
        setClosedHint(false);
        setJob(next);
        setActiveRequestId(next.id);
        cacheJob(next);
        setError("");
        return;
      }
      setJob((prev) => {
        if (prev) queueMicrotask(() => setClosedHint(true));
        return null;
      });
      setError("");
      await refreshCurrentJob();
    } catch (e) {
      setError(jobError(e));
    }
  }, [setActiveRequestId, refreshCurrentJob]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const offLoc = subscribeRealtime("location:update", (payload) => {
      if (!job?.id || String(payload.requestId || payload.jobId || "") !== job.id) return;
      const lat = Number(payload.lat ?? payload.latitude);
      const lng = Number(payload.lng ?? payload.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const at = Number(payload.timestamp ?? payload.at) || Date.now();
      setLiveWorker({ lat, lng, at });
      setJob((prev) =>
        prev
          ? {
              ...prev,
              workerLat: lat,
              workerLng: lng,
              workerLocationAt: new Date(at).toISOString(),
              distanceKm: typeof payload.distanceKm === "number" ? payload.distanceKm : prev.distanceKm,
              etaMinutes: typeof payload.etaMinutes === "number" ? payload.etaMinutes : prev.etaMinutes,
            }
          : prev
      );
    });
    const offStatus = subscribeRealtime("job:status_change", (payload) => {
      if (!job?.id || String(payload.requestId || payload.jobId || "") !== job.id) return;
      void load();
    });
    const offConn = subscribeConnection(setSocketState);
    return () => {
      offLoc();
      offStatus();
      offConn();
    };
  }, [job?.id, load]);

  const loc = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return {};
    }
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!navigator.onLine) {
      setError("Connection lost. We're keeping your active job safe.");
      return;
    }
    setBusy(label);
    setError("");
    try {
      await fn();
      await load();
      await refreshCurrentJob();
    } catch (e) {
      setError(jobError(e));
    } finally {
      setBusy("");
    }
  };

  if (!job) {
    const nextView = worker ? "worker-next-jobs" : "create-request";
    const historyView = worker ? "my-jobs" : "my-requests";
    return (
      <div className="p-5 max-w-lg mx-auto space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("job.activeJob")}</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">No active job</h1>
        {closedHint ? (
          <p className="text-sm text-slate-600">Your previous job is completed.</p>
        ) : null}
        <p className="text-sm text-slate-500">{error || "Ready for your next job?"}</p>
        <Button className="w-full min-h-12" onClick={() => navigate(nextView)}>
          {worker ? "Find New Jobs" : "Post a New Job"}
        </Button>
        <Button variant="outline" className="w-full min-h-12" onClick={() => navigate(historyView)}>
          View completed jobs
        </Button>
      </div>
    );
  }

  const action = jobPrimaryAction(job.status);
  const amount = jobAmountRupees(job);
  const problemText =
    worker && job.translatedDescription && job.translatedDescription !== job.description
      ? job.translatedDescription
      : job.description;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-28">
      {!online && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
          Connection lost. We're keeping your active job safe.
        </p>
      )}
      {error && <p className="text-sm bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2">{error}</p>}
      <SimulatedMoneyBanner />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {worker ? t("job.activeJob") : isTrackingStatus(job.status) ? "Track Your Worker" : t("job.activeJob")}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {worker ? "Customer Request" : job.category}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Job ID {job.code}
            {job.etaMinutes ? ` · ETA ${job.etaMinutes} min` : ""}
          </p>
          <Chip size="small" color="primary" label={statusLabel(job.status)} sx={{ mt: 1 }} />
        </div>
        {canCancelJob(job.status) && (
          <div className="shrink-0">
            <CancelJobPanel
              variant="button"
              worker={worker}
              job={job}
              policy={job.cancelPolicy}
              busy={busy === "cancel"}
              onCancel={(reason) => void run("cancel", () => RequestAPI.cancel(job.id, { reason }))}
            />
          </div>
        )}
      </div>

      {job.delayReason && (
        <Card padding="md" className="bg-sky-50 border-sky-200">
          <p className="text-sm text-sky-900">
            Worker is delayed due to {job.delayReason.replace(/_/g, " ").toLowerCase()}.
            {job.etaMinutes ? ` Updated ETA: ${job.etaMinutes} minutes.` : ""}
          </p>
        </Card>
      )}

      <JobProgress status={job.status} />

      <JobTrackingPanel
        job={job}
        workerRole={worker}
        gpsState={gpsState}
        socketState={socketState}
        workerLat={liveWorker?.lat ?? job.workerLat}
        workerLng={liveWorker?.lng ?? job.workerLng}
        workerLocationAt={liveWorker?.at ?? job.workerLocationAt}
      />

      {!isTrackingStatus(job.status) && (
        <Card padding="md" className="space-y-2">
          {worker ? (
            <>
              <p className="text-xs text-slate-500">Customer</p>
              <p className="font-semibold">{job.customer?.name || "Customer"}</p>
              <p className="text-sm text-slate-600">
                {job.area || job.city}
                {job.distanceKm != null ? ` · ${job.distanceKm} km` : ""}
              </p>
              {(job.tower || job.flat || job.gateNote) && (
                <p className="text-sm bg-slate-50 rounded-xl px-3 py-2">
                  {job.tower ? `Tower ${job.tower}` : ""} {job.flat ? `Flat ${job.flat}` : ""}
                  {job.visitorName ? ` · Visitor: ${job.visitorName}` : ""}
                  {job.gateNote ? ` · ${job.gateNote}` : ""}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">Worker</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100">
                  {job.provider?.avatar ? (
                    <img src={mediaUrl(job.provider.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold">
                      {(job.provider?.name || "W").slice(0, 1)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold">{job.provider?.name || "Worker"}</p>
                  <p className="text-xs text-slate-500">
                    ⭐ {job.provider?.rating || 0}
                    {job.provider?.verified ? " · Verified" : ""}
                  </p>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      <Card padding="md" className="space-y-2">
        <p className="text-xs text-slate-500">Problem</p>
        <p className="text-slate-800">{problemText}</p>
        {worker && job.translatedDescription && job.customerLanguage !== job.workerLanguage && (
          <p className="text-xs text-slate-500">Original language: {job.customerLanguage?.toUpperCase()}</p>
        )}
        {job.voiceNote && <audio controls src={mediaUrl(job.voiceNote)} className="w-full mt-1" />}
        {(job.photos || []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {job.photos?.map((src) => (
              <img key={src} src={mediaUrl(src)} alt="" className="w-20 h-20 rounded-xl object-cover" />
            ))}
          </div>
        )}
        <p className="text-sm font-semibold">{formatRupees(amount)}</p>
      </Card>

      {!worker && job.status === "arrived" && job.jobOtp && (
        <Card padding="md" className="text-center">
          <p className="text-sm font-semibold text-slate-800">Your Fixbuddy worker has arrived.</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Please provide the 4-digit OTP to start the service.</p>
          <p className="text-5xl font-black font-display tracking-[0.3em] my-2">{job.jobOtp}</p>
        </Card>
      )}

      {worker && action === "otp" && (
        <div className="space-y-2">
          <p className="text-center text-sm font-semibold text-slate-600">Enter Customer OTP</p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Enter 4-digit OTP"
            aria-label="Enter 4-digit OTP"
            className="w-full min-h-14 rounded-2xl border border-slate-200 text-center text-2xl tracking-[0.4em] font-bold"
          />
          <Button
            className="w-full min-h-14 text-lg"
            disabled={otp.length !== 4 || !!busy}
            onClick={() => void run("otp", () => RequestAPI.verifyOtp(job.id, otp))}
          >
            Verify OTP
          </Button>
        </div>
      )}

      {worker && action === "enroute" && (
        <Button
          className="w-full min-h-14 text-lg"
          disabled={!!busy}
          onClick={() =>
            void run("enroute", async () => {
              const here = await loc();
              await RequestAPI.enroute(job.id, here);
            })
          }
        >
          <Navigation className="w-5 h-5" /> {t("job.onTheWay")}
        </Button>
      )}
      {worker && action === "arrive" && (
        <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("arrive", async () => RequestAPI.arrive(job.id, await loc()))}>
          Mark as Arrived
        </Button>
      )}
      {worker && (action === "start" || job.status === "in_progress") && (
        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Work in Progress</p>
          <p className="text-sm">Customer: {job.customer?.name || "Customer"}</p>
          <p className="text-sm">Service: {job.category}</p>
          <p className="text-sm font-semibold text-emerald-700">● Work Started</p>
          {action === "complete" || job.status === "in_progress" ? (
            <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("complete", () => RequestAPI.complete(job.id))}>
              <Flag className="w-5 h-5" /> Complete Work
            </Button>
          ) : (
            <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("start", () => RequestAPI.start(job.id))}>
              <Play className="w-5 h-5" /> {t("job.start")}
            </Button>
          )}
        </Card>
      )}
      {worker && action === "collect" && (
        <div className="space-y-2">
          <SimulatedMoneyBanner />
          <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("collect", () => RequestAPI.collectPayment(job.id))}>
            <Wallet className="w-5 h-5" /> Record simulated collection ₹{amount}
          </Button>
        </div>
      )}
      {!worker && job.status === "completed" && job.paymentStatus !== "collected" && (
        <div className="space-y-2">
          <SimulatedMoneyBanner />
          <p className="text-center font-semibold">Work completed?</p>
          <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("complete", () => RequestAPI.customerComplete(job.id))}>
            Confirm Completion
          </Button>
        </div>
      )}

      {canCancelJob(job.status) && (
        <CancelJobPanel
          worker={worker}
          job={job}
          policy={job.cancelPolicy}
          busy={busy === "cancel"}
          onCancel={(reason) => void run("cancel", () => RequestAPI.cancel(job.id, { reason }))}
        />
      )}

      {worker && ["in_progress", "arrived", "otp_verified", "completed"].includes(job.status) && (
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">Proof of work</p>
          <div className="flex gap-2">
            {(["before", "during", "after"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPhotoStage(s)}
                className={`flex-1 min-h-10 rounded-xl text-xs font-semibold ${photoStage === s ? "bg-slate-900 text-white" : "bg-slate-100"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="block text-center min-h-11 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 py-3 cursor-pointer">
            Add {photoStage} photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadImage(file)
                  .then((r) => run("photo", () => RequestAPI.workPhotos(job.id, photoStage, r.url)))
                  .catch((err) => setError(jobError(err)));
              }}
            />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {(job.workPhotos?.[photoStage] || []).map((src) => (
              <img key={src} src={mediaUrl(src)} alt="" className="w-16 h-16 rounded-lg object-cover" />
            ))}
          </div>
        </Card>
      )}

      {worker && ["accepted", "scheduled", "on_the_way"].includes(job.status) && (
        <div className="grid grid-cols-2 gap-2">
          {["HEAVY_RAIN", "TRAFFIC", "FOG", "ROAD_BLOCK"].map((reason) => (
            <button
              key={reason}
              type="button"
              className="min-h-11 rounded-xl border border-slate-200 text-xs font-semibold"
              onClick={() => void run("delay", () => RequestAPI.delay(job.id, reason))}
            >
              {reason.replace(/_/g, " ").toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <Card padding="md">
        <p className="text-xs font-semibold text-slate-500 mb-2">Job timeline</p>
        <ol className="space-y-1.5">
          {TIMELINE.map((row) => {
            const done = stepDone(job.status, row.match) || stepActive(job.status, row.match);
            const active = stepActive(job.status, row.match);
            return (
              <li key={row.label} className={`text-sm ${active ? "text-sky-700 font-semibold" : done ? "text-emerald-700" : "text-slate-400"}`}>
                {done && !active ? "✓" : active ? "●" : "○"} {row.label}
              </li>
            );
          })}
        </ol>
      </Card>

      {!worker && (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full min-h-12"
            onClick={() =>
              void run("watch", async () => {
                const r = await RequestAPI.watchLink(job.id);
                const url = `${window.location.origin}/watch/${r.token}`;
                setWatchUrl(url);
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  /* ignore */
                }
              })
            }
          >
            <Share2 className="w-4 h-4" /> Share with family
          </Button>
          {watchUrl && <p className="text-xs text-slate-500 break-all">{watchUrl}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => startCall(worker ? job.customer?.phone : job.provider?.phone)} className="min-h-12 rounded-xl border font-semibold text-sm flex items-center justify-center gap-1">
          <Phone className="w-4 h-4" /> Call
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border font-semibold text-sm flex items-center justify-center gap-1"
          onClick={() =>
            void ChatAPI.open(job.id, user?.id).then(() => {
              setActiveRequestId(job.id);
              navigate(worker ? "business-messages" : "customer-messages");
            })
          }
        >
          <MessageSquare className="w-4 h-4" /> Support
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-red-200 text-red-600 font-semibold text-sm flex items-center justify-center gap-1"
          onClick={() => {
            setActiveRequestId(job.id);
            navigate(worker ? "worker-safety" : "customer-support");
          }}
        >
          <Shield className="w-4 h-4" /> Safety
        </button>
      </div>
    </div>
  );
}
