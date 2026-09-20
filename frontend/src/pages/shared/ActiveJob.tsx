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
  IndianRupee,
  Package,
  RefreshCw,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { View } from "../../types";
import { Button, Card } from "../../components/ui";
import { JobProgress, jobPrimaryAction } from "../../components/JobProgress";
import JobTrackingPanel, { isTrackingStatus } from "../../components/JobTrackingPanel";
import CancelJobPanel from "../../components/CancelJobPanel";
import JobDisputeModal from "../../components/JobDisputeModal";
import {
  PriceChangeModal,
  PriceChangeCard,
  MaterialRequestModal,
  MaterialRequestCard,
  FinalBillCard,
  HandoverModal,
  NoShowModal,
  RescheduleModal,
  RescheduleWorkerCard,
} from "./ActiveJobPanels";
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
  const [receipt, setReceipt] = useState<{
    role: "worker" | "customer";
    amount: number;
    net?: number;
    commission?: number;
    category: string;
    code?: string;
  } | null>(null);
  const [photoStage, setPhotoStage] = useState<"before" | "during" | "after">("before");
  const [liveWorker, setLiveWorker] = useState<{ lat: number; lng: number; at: number } | null>(null);
  const [socketState, setSocketState] = useState<RealtimeConnectionState>(getRealtimeConnectionState());
  const gpsState = useWorkerGps(job?.id, job?.status, worker);

  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

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

  const successReceipt = receipt;
  if (successReceipt) {
    const paid = formatRupees(successReceipt.amount);
    const netLabel = successReceipt.net != null ? formatRupees(successReceipt.net) : paid;
    const nextView = worker ? "worker-next-jobs" : "create-request";
    const historyView = worker ? "my-jobs" : "my-requests";
    return (
      <div className="p-5 max-w-lg mx-auto space-y-5 animate-fade-in" data-testid="payment-success">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-600 text-white p-6 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
            {successReceipt.role === "worker" ? "Payment collected" : "Job confirmed"}
          </p>
          <div className="mt-4 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black">✓</div>
          </div>
          <p className="mt-4 text-center font-display text-4xl font-black tracking-tight">{paid}</p>
          <p className="mt-2 text-center text-emerald-50 text-sm">
            {successReceipt.category}
            {successReceipt.code ? ` · ${successReceipt.code}` : ""}
          </p>
          {successReceipt.role === "worker" && (
            <div className="mt-5 rounded-2xl bg-white/15 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-emerald-100">Job amount</span>
                <span className="font-semibold">{paid}</span>
              </div>
              {successReceipt.commission != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-emerald-100">Commission</span>
                  <span>{formatRupees(successReceipt.commission)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 pt-1 border-t border-white/20">
                <span className="text-emerald-100">Your earnings</span>
                <span className="font-bold text-lg">{netLabel}</span>
              </div>
            </div>
          )}
          {successReceipt.role === "customer" && (
            <p className="mt-4 text-center text-sm text-emerald-50">
              You confirmed the work and the agreed amount of {paid}.
            </p>
          )}
        </div>
        <Button
          className="w-full min-h-14 text-lg"
          onClick={() => {
            setReceipt(null);
            navigate(nextView);
          }}
        >
          {worker ? "Find next job" : "Post a New Job"}
        </Button>
        <Button
          variant="outline"
          className="w-full min-h-12"
          onClick={() => {
            setReceipt(null);
            navigate(historyView);
          }}
        >
          View completed jobs
        </Button>
      </div>
    );
  }

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
  const isCrewLead = !job.crewId || String(job.provider?.id || "") === String(user?.id || "");
  const isCrewMemberOnly = worker && !!job.crewId && !isCrewLead;
  const canLeadActions = worker && isCrewLead;
  const photoUrl = (p: { url: string } | string) => (typeof p === "string" ? p : p.url);
  const stageAllowed = (stage: "before" | "during" | "after") => {
    if (["cancelled", "declined", "reviewed", "payment_collected", "customer_completed"].includes(job.status)) return false;
    if (stage === "before") return ["arrived", "otp_verified", "in_progress"].includes(job.status);
    if (stage === "during") return job.status === "in_progress";
    return ["in_progress", "completed"].includes(job.status);
  };
  const canUploadProof = worker && stageAllowed(photoStage);
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
        {canCancelJob(job.status) && (canLeadActions || !worker) && (
          <div className="shrink-0">
            <CancelJobPanel
              variant="button"
              worker={!!worker}
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

      {/* Production Flow Cards (Reschedule, Price Changes, Materials, Final Bill) */}
      <RescheduleWorkerCard job={job} onRefresh={() => void load()} />
      {job.priceChangeRequests?.map((p) => (
        <PriceChangeCard key={p.id} job={job} request={p} onRefresh={() => void load()} />
      ))}
      {job.materialRequests?.map((m) => (
        <MaterialRequestCard key={m.id} job={job} material={m} onRefresh={() => void load()} />
      ))}
      <FinalBillCard job={job} isWorker={Boolean(worker)} onRefresh={() => void load()} />

      {/* Handover & No-Show Quick Actions */}
      {worker && canLeadActions && ["accepted", "scheduled", "on_the_way", "arrived", "in_progress"].includes(job.status) && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 flex-1 min-h-10"
            onClick={() => setShowHandoverModal(true)}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Handover Job
          </Button>
          {job.status === "arrived" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 flex-1 min-h-10"
              onClick={() => setShowNoShowModal(true)}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Customer Unavailable
            </Button>
          )}
        </div>
      )}

      {!worker && ["accepted", "scheduled", "on_the_way"].includes(job.status) && (
        <div className="flex items-center gap-2">
          {["accepted", "scheduled"].includes(job.status) && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1 min-h-10"
              onClick={() => setShowRescheduleModal(true)}
            >
              <Calendar className="w-3.5 h-3.5 text-brand" /> Reschedule
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 flex-1 min-h-10"
            onClick={() => setShowNoShowModal(true)}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Report No-Show
          </Button>
        </div>
      )}

      {(job.crewMembers?.length || job.crew) && (
        <Card padding="md" className="space-y-3 border-sky-100 bg-sky-50/40">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Crew assigned</p>
          <p className="font-display text-lg font-bold text-slate-900">{job.crew?.name || "FixBuddy Crew"}</p>
          <div className="space-y-2">
            {(job.crewMembers || []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.isLead || m.role === "leader" ? "Crew Lead" : m.category || m.role || "Member"}
                    {m.verified ? " · Verified" : ""}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 capitalize">{m.state}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isCrewMemberOnly && (
        <p className="text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2">
          Crew lead controls this job lifecycle. You can view the job and upload work proof when allowed.
        </p>
      )}

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

      {canLeadActions && action === "otp" && (
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

      {canLeadActions && action === "enroute" && (
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
      {canLeadActions && action === "arrive" && (
        <Button className="w-full min-h-14 text-lg" disabled={!!busy} onClick={() => void run("arrive", async () => RequestAPI.arrive(job.id, await loc()))}>
          Mark as Arrived
        </Button>
      )}
      {canLeadActions && (action === "start" || job.status === "in_progress") && (
        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Work in Progress</p>
          <p className="text-sm">Customer: {job.customer?.name || "Customer"}</p>
          <p className="text-sm">Service: {job.category}</p>
          <p className="text-sm font-semibold text-emerald-700">● Work Started</p>
          {job.status === "in_progress" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs min-h-10"
                onClick={() => setShowPriceChangeModal(true)}
              >
                <IndianRupee className="w-3.5 h-3.5 text-amber-600" /> Price Change
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs min-h-10"
                onClick={() => setShowMaterialModal(true)}
              >
                <Package className="w-3.5 h-3.5 text-brand" /> Add Materials
              </Button>
            </div>
          )}
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
      {canLeadActions && action === "collect" && (
        <div className="space-y-2">
          <SimulatedMoneyBanner />
          <Card padding="md" className="space-y-2 text-center border-emerald-200 bg-emerald-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Collect from customer</p>
            <p className="font-display text-4xl font-black text-navy">₹{amount.toLocaleString("en-IN")}</p>
            <p className="text-sm text-slate-600">{job.category}</p>
          </Card>
          {job.finance?.settled && (
            <Card padding="md" className="space-y-1 text-sm">
              <p className="font-semibold">Job Amount · {formatRupees(job.finance.jobPriceRupees)}</p>
              <p className="text-slate-600">FixBuddy Commission · {formatRupees(job.finance.commissionRupees)} ({job.finance.commissionPercent}%)</p>
              <p className="text-emerald-700 font-semibold">Your Earnings · {formatRupees(job.finance.workerNetRupees)}</p>
            </Card>
          )}
          <Button
            className="w-full min-h-14 text-lg"
            disabled={!!busy}
            onClick={() => {
              void (async () => {
                if (!navigator.onLine) {
                  setError("Connection lost. We're keeping your active job safe.");
                  return;
                }
                setBusy("collect");
                setError("");
                const snap = {
                  role: "worker" as const,
                  amount: jobAmountRupees(job),
                  net: job.finance?.workerNetRupees,
                  commission: job.finance?.commissionRupees,
                  category: job.category,
                  code: job.code,
                };
                try {
                  await RequestAPI.collectPayment(job.id);
                  setReceipt(snap);
                  await refreshCurrentJob();
                } catch (e) {
                  setError(jobError(e));
                } finally {
                  setBusy("");
                }
              })();
            }}
          >
            <Wallet className="w-5 h-5" /> Collect ₹{amount.toLocaleString("en-IN")}
          </Button>
        </div>
      )}
      {!worker && job.status === "completed" && job.paymentStatus !== "collected" && (
        <div className="space-y-2">
          <SimulatedMoneyBanner />
          <Card padding="md" className="space-y-2 text-center border-sky-200 bg-sky-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Confirm amount</p>
            <p className="font-display text-4xl font-black text-navy">₹{amount.toLocaleString("en-IN")}</p>
            <p className="text-sm text-slate-600">{job.category} · work completed</p>
          </Card>
          <p className="text-center font-semibold text-slate-800">Confirm you received the work for this amount?</p>
          <Button
            className="w-full min-h-14 text-lg"
            disabled={!!busy}
            onClick={() => {
              void (async () => {
                if (!navigator.onLine) {
                  setError("Connection lost. We're keeping your active job safe.");
                  return;
                }
                setBusy("complete");
                setError("");
                const snap = {
                  role: "customer" as const,
                  amount: jobAmountRupees(job),
                  category: job.category,
                  code: job.code,
                };
                try {
                  await RequestAPI.customerComplete(job.id);
                  setReceipt(snap);
                  await refreshCurrentJob();
                } catch (e) {
                  setError(jobError(e));
                } finally {
                  setBusy("");
                }
              })();
            }}
          >
            Confirm Completion · ₹{amount.toLocaleString("en-IN")}
          </Button>
        </div>
      )}

      {canCancelJob(job.status) && canLeadActions && (
        <CancelJobPanel
          worker={worker}
          job={job}
          policy={job.cancelPolicy}
          busy={busy === "cancel"}
          onCancel={(reason) => void run("cancel", () => RequestAPI.cancel(job.id, { reason }))}
        />
      )}
      {canCancelJob(job.status) && !worker && (
        <CancelJobPanel
          worker={false}
          job={job}
          policy={job.cancelPolicy}
          busy={busy === "cancel"}
          onCancel={(reason) => void run("cancel", () => RequestAPI.cancel(job.id, { reason }))}
        />
      )}

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Work Proof</p>
          <p className="text-[11px] text-slate-400">
            {job.workPhotoCount || 0} photos
            {job.workPhotosUpdatedAt
              ? ` · Updated ${new Date(job.workPhotosUpdatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {(["before", "during", "after"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPhotoStage(s)}
              className={`flex-1 min-h-10 rounded-xl text-xs font-semibold capitalize ${photoStage === s ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              {s === "during" ? "During" : s}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {photoStage === "before" ? "Before work" : photoStage === "during" ? "During work" : "After work"}
        </p>
        <div className="flex gap-2 overflow-x-auto items-center">
          {(job.workPhotos?.[photoStage] || []).map((p) => {
            const src = photoUrl(p);
            return (
              <div key={src} className="shrink-0">
                <img src={mediaUrl(src)} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
              </div>
            );
          })}
          {worker && canUploadProof && (
            <label className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-slate-300 text-[10px] font-semibold text-slate-600 flex items-center justify-center text-center px-1 cursor-pointer">
              {photoStage === "during" ? "+ Progress" : "+ Add"}
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
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {worker && !canUploadProof && (
            <p className="text-xs text-slate-500 py-2">Uploads for this stage are not available right now.</p>
          )}
        </div>
      </Card>

      {worker && job.finance?.settled && action !== "collect" && (
        <Card padding="md" className="space-y-1 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Earnings (demo)</p>
          <p>Job Amount · {formatRupees(job.finance.jobPriceRupees)}</p>
          <p className="text-slate-600">FixBuddy Commission · {formatRupees(job.finance.commissionRupees)}</p>
          <p className="text-emerald-700 font-semibold">Your Earnings · {formatRupees(job.finance.workerNetRupees)}</p>
        </Card>
      )}

      {canLeadActions && ["accepted", "scheduled", "on_the_way"].includes(job.status) && (
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
          {watchUrl && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs text-slate-600 break-all font-mono">{watchUrl}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={() =>
                  void run("revokeWatch", async () => {
                    await RequestAPI.revokeWatch(job.id);
                    setWatchUrl("");
                  })
                }
              >
                Stop Sharing / Revoke Link
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => startCall(worker ? job.customer?.phone : job.provider?.phone)}
          className="min-h-12 rounded-xl border font-semibold text-xs flex flex-col items-center justify-center gap-1"
        >
          <Phone className="w-4 h-4" /> Call
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border font-semibold text-xs flex flex-col items-center justify-center gap-1"
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
          className="min-h-12 rounded-xl border font-semibold text-xs flex flex-col items-center justify-center gap-1"
          onClick={() => setShowDisputeModal(true)}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" /> Report
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-red-200 text-red-600 font-semibold text-xs flex flex-col items-center justify-center gap-1"
          onClick={() => {
            setActiveRequestId(job.id);
            navigate(worker ? "worker-safety" : "customer-support");
          }}
        >
          <Shield className="w-4 h-4" /> Safety
        </button>
      </div>

      {/* Production Flow Modals */}
      {showPriceChangeModal && (
        <PriceChangeModal
          job={job}
          onClose={() => setShowPriceChangeModal(false)}
          onSuccess={() => void load()}
        />
      )}
      {showMaterialModal && (
        <MaterialRequestModal
          job={job}
          onClose={() => setShowMaterialModal(false)}
          onSuccess={() => void load()}
        />
      )}
      {showHandoverModal && (
        <HandoverModal
          job={job}
          onClose={() => setShowHandoverModal(false)}
          onSuccess={() => {
            void load();
            navigate(worker ? "worker-next-jobs" : "customer-home");
          }}
        />
      )}
      {showNoShowModal && (
        <NoShowModal
          job={job}
          isWorker={Boolean(worker)}
          onClose={() => setShowNoShowModal(false)}
          onSuccess={() => {
            void load();
            if (!worker) navigate("customer-home");
          }}
        />
      )}
      {showRescheduleModal && (
        <RescheduleModal
          job={job}
          onClose={() => setShowRescheduleModal(false)}
          onSuccess={() => void load()}
        />
      )}
      {showDisputeModal && (
        <JobDisputeModal
          requestId={job.id}
          jobCode={job.code}
          onClose={() => setShowDisputeModal(false)}
          onSuccess={() => void load()}
        />
      )}
    </div>
  );
}
