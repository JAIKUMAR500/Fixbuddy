import React from "react";
import { ArrowLeft, MapPin, Clock, Phone, MessageSquare, CheckCircle, Play, Flag, Navigation, KeyRound, Wallet, Star } from "lucide-react";
import { View } from "../../types";
import { Button, Card, RatingStars, Avatar, EmptyState, FetchBanner } from "../../components/ui";
import { JobProgress, jobPrimaryAction } from "../../components/JobProgress";
import LiveTrackMap from "../../components/LiveTrackMap";
import CancelJobPanel from "../../components/CancelJobPanel";
import { useApp, useFetch } from "../../api/AppContext";
import { RequestAPI, ChatAPI, SafetyAPI, mediaUrl, type JobRequest } from "../../api/client";
import { isBusiness } from "../../api/roles";
import { startCall, jobAllowsCall } from "../../api/phone";
import { canCancelJob, jobError, statusLabel } from "../../api/jobLock";
import { SimulatedMoneyBanner } from "../../components/SimulatedMoney";
import { subscribeRealtime } from "../../api/realtime";
import { jobAmountRupees, formatRupees } from "../../api/money";

const TRACKING = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress"];

export default function RequestStatus({ navigate }: { navigate: (v: View) => void }) {
  const { viewingRequestId, activeRequestId, setActiveRequestId, user, refreshCurrentJob } = useApp();
  const displayedId = viewingRequestId || activeRequestId;
  const [otpInput, setOtpInput] = React.useState("");
  const [reviewStars, setReviewStars] = React.useState(5);
  const [reviewText, setReviewText] = React.useState("");
  const [showReview, setShowReview] = React.useState(false);
  const path = displayedId ? `/requests/${displayedId}` : null;
  const { data, loading, error, reload } = useFetch<{ request: JobRequest | null }>(path, displayedId ? 1 : 0);
  const [cancelling, setCancelling] = React.useState(false);
  const [reportMsg, setReportMsg] = React.useState("");
  const [acting, setActing] = React.useState("");
  const request = data?.request || null;
  const provider = request?.provider;
  const worker = user?.role === "worker";
  const invitedCount = request?.invitedProviderIds?.length || 0;
  const waitingForAccept = request && ["open", "requested", "matching"].includes(request.status) && !request.providerId;
  const backView = user?.role === "customer" ? "my-requests" : "my-jobs";
  const callPhone = worker ? request?.customer?.phone : provider?.phone;
  const amount = jobAmountRupees(request);


  React.useEffect(() => {
    if (request?.status === "customer_completed" || (request?.paymentStatus === "collected" && request.customerCompleted && request.status !== "reviewed")) {
      setShowReview(true);
    }
  }, [request?.status, request?.paymentStatus, request?.customerCompleted]);

  React.useEffect(() => {
    if (!request?.id) return;
    const t = window.setInterval(() => reload(), 8000);
    return () => window.clearInterval(t);
  }, [request?.id, reload]);

  React.useEffect(() => {
    if (!worker || !request?.id || !TRACKING.includes(request.status)) return;
    if (!navigator.geolocation) return;
    const last = { t: 0 };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last.t < 15000) return;
        last.t = now;
        void RequestAPI.pingLocation(request.id, pos.coords.latitude, pos.coords.longitude).then(() => reload()).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [worker, request?.id, request?.status, reload]);

  const [openingChat, setOpeningChat] = React.useState(false);
  const [chatError, setChatError] = React.useState("");
  const [liveWorker, setLiveWorker] = React.useState<{ lat: number; lng: number } | null>(null);

  React.useEffect(() => {
    if (!request?.id) return;
    return subscribeRealtime("location:update", (payload) => {
      if (String(payload.requestId || payload.jobId || "") !== request.id) return;
      const lat = Number(payload.lat ?? payload.latitude);
      const lng = Number(payload.lng ?? payload.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setLiveWorker({ lat, lng });
    });
  }, [request?.id]);

  const openChat = async () => {
    if (!request?.id || !provider) return;
    setOpeningChat(true);
    setChatError("");
    try {
      await ChatAPI.open(request.id);
      setActiveRequestId(request.id);
      navigate(worker || isBusiness(user?.role) ? "business-messages" : "customer-messages");
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setOpeningChat(false);
    }
  };

  const cancelRequest = async (reason: string) => {
    if (!request?.id || (displayedId && request.id !== displayedId)) return;
    setCancelling(true);
    setChatError("");
    try {
      await RequestAPI.cancel(request.id, { reason: reason || (worker ? "Worker cancelled" : "Customer cancelled") });
      await refreshCurrentJob();
      navigate(backView);
    } catch (e) {
      setChatError(jobError(e));
    } finally {
      setCancelling(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setActing("1");
    setChatError("");
    try {
      await fn();
      reload();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing("");
    }
  };

  const coords = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return {};
    }
  };

  const timeline = request?.timeline?.length
    ? request.timeline.map((item, i) => ({
        id: `${item.status}-${i}`,
        label: item.status.replace(/_/g, " "),
        desc: item.note,
        time: item.at ? new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "",
        done: true,
        current: i === request.timeline.length - 1,
      }))
    : [];

  const action = request ? jobPrimaryAction(request.status) : null;

  return (
    <div className="min-h-screen bg-sky-50 animate-fade-in">
      <header className="sticky top-0 z-10 bg-white border-b border-sky-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(backView)} className="p-3 rounded-xl hover:bg-sky-50 min-w-11 min-h-11">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-slate-900 text-lg sm:text-xl">Live tracking</h1>
            <p className="text-sm text-slate-500">{request?.code || "Request"} · {request?.category || "Service request"}</p>
          </div>
          {request && canCancelJob(request.status) && (
            <CancelJobPanel
              variant="button"
              worker={worker}
              job={request}
              policy={request.cancelPolicy}
              busy={cancelling}
              onCancel={(reason) => void cancelRequest(reason)}
            />
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-24">
        <FetchBanner error={error} onRetry={reload} loading={loading} />
        {!displayedId && !loading && (
          <EmptyState
            icon="📍"
            title="Select a request"
            description="Open a request from My Requests or My Jobs to view its status."
            actionLabel="Back"
            onAction={() => navigate(backView)}
          />
        )}
        {displayedId && !loading && !request && !error && (
          <EmptyState
            icon="📍"
            title="Request not found"
            description="This request is missing or you no longer have access to it."
            actionLabel="Back"
            onAction={() => navigate(backView)}
          />
        )}
        {loading && <Card className="text-base text-slate-500">Loading request status...</Card>}
        {chatError && <Card className="border-red-200 bg-red-50 text-base text-red-700">{chatError}</Card>}

        {request && (
          <>
            <div className="bg-sky-600 rounded-3xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 bg-emerald-300 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-sky-100 uppercase tracking-wide">{statusLabel(request.status)}</span>
              </div>
              <h2 className="font-display text-2xl font-bold mb-2">{request.category}</h2>
              <p className="text-sky-50 mb-4">{request.description}</p>
              <div className="flex flex-wrap gap-4 text-sky-50 text-sm">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{request.scheduledLabel || request.timing}</span>
                <span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{request.area || request.city}</span>
                {request.distanceKm != null && <span>{request.distanceKm} km · {request.etaMinutes || "—"} min</span>}
              </div>
            </div>

            <Card padding="lg">
              <JobProgress status={request.status} />
            </Card>

            {TRACKING.includes(request.status) && (
              <Card padding="none" className="overflow-hidden">
                <LiveTrackMap
                  customer={{ lat: request.lat, lng: request.lng }}
                  worker={
                    worker
                      ? null
                      : {
                          lat: liveWorker?.lat ?? request.workerLat,
                          lng: liveWorker?.lng ?? request.workerLng,
                        }
                  }
                  workerRole={worker}
                  waitingForWorker={!worker && liveWorker == null && request.workerLat == null}
                  tapHint={
                    worker
                      ? "Customer house for this job. Stay on this screen."
                      : "Watch the worker live in FixBuddy. No need to open another map."
                  }
                />
                <div className="px-4 py-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  {request.distanceKm != null && <span className="font-semibold text-slate-800">{request.distanceKm} km away</span>}
                  {request.etaMinutes != null && <span>ETA {request.etaMinutes} min</span>}
                </div>
              </Card>
            )}

            {!!request.crewMembers?.length && (
              <Card padding="md">
                <p className="font-semibold text-slate-900 mb-2">{request.crewMembers.length} workers assigned</p>
                <div className="space-y-1.5">
                  {request.crewMembers.map((m) => (
                    <p key={m.id} className="text-sm text-slate-600">
                      {m.state === "arrived" ? "✓" : m.state === "arriving" ? "→" : "·"} {m.name} · {m.state === "arrived" ? "Arrived" : m.state === "arriving" ? "Arriving" : "Assigned"}
                    </p>
                  ))}
                </div>
              </Card>
            )}

            {request.status === "arrived" && !worker && request.jobOtp && (
              <Card padding="lg" className="bg-amber-50 border-amber-200 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Share this OTP with the worker</p>
                <p className="text-5xl font-black font-display tracking-[0.3em] text-slate-900 my-3">{request.jobOtp}</p>
                <p className="text-sm text-amber-800">Work starts only after the worker enters this code.</p>
              </Card>
            )}

            <Card padding="lg">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-sky-100 bg-sky-50 flex-shrink-0">
                  {provider?.avatar ? (
                    <img src={mediaUrl(provider.avatar)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <Avatar src="" name={provider?.name || request.customer?.name || "User"} size="xl" className="rounded-2xl w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-lg">
                    {worker ? request.customer?.name || "Customer" : provider?.name || "Waiting for a worker"}
                  </h3>
                  {provider && !worker ? (
                    <RatingStars value={provider.rating} count={provider.reviews} />
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">
                      {waitingForAccept && invitedCount
                        ? `${invitedCount} worker${invitedCount === 1 ? "" : "s"} asked. First to accept takes this job.`
                        : worker ? "Navigate to the service location." : "No worker assigned yet"}
                    </p>
                  )}
                </div>
                {(provider || (worker && request.customer)) && (
                  <div className="flex gap-2">
                    <button type="button" disabled={openingChat} onClick={() => void openChat()} className="px-4 min-h-12 bg-sky-600 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                      <MessageSquare className="w-5 h-5" /> Message
                    </button>
                    {jobAllowsCall(request.status) && (
                      <button type="button" onClick={() => startCall(callPhone)} className="px-4 min-h-12 bg-emerald-600 text-white rounded-xl font-semibold flex items-center gap-2">
                        <Phone className="w-5 h-5" /> Call
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {waitingForAccept && !worker && (
              <Button size="lg" fullWidth onClick={() => navigate("matched-providers")}>Request more workers</Button>
            )}

            {worker && request.providerId === user?.id && (
              <Card padding="lg" className="space-y-3">
                {action === "enroute" && (
                  <Button
                    size="lg"
                    fullWidth
                    loading={!!acting}
                    onClick={() =>
                      void run(async () => {
                        const here = await coords();
                        await RequestAPI.enroute(request.id, here);
                      })
                    }
                  >
                    <Navigation className="w-5 h-5" /> On the way
                  </Button>
                )}
                {action === "arrive" && (
                  <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(async () => RequestAPI.arrive(request.id, await coords()))}>
                    <MapPin className="w-5 h-5" /> I've arrived
                  </Button>
                )}
                {action === "otp" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Ask the customer for the 4-digit OTP on their screen.</p>
                    <input
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      className="w-full text-center text-3xl tracking-[0.4em] font-black rounded-2xl border border-slate-200 py-3"
                    />
                    <Button size="lg" fullWidth disabled={otpInput.length !== 4} loading={!!acting} onClick={() => void run(() => RequestAPI.verifyOtp(request.id, otpInput))}>
                      <KeyRound className="w-5 h-5" /> Verify OTP
                    </Button>
                  </div>
                )}
                {action === "start" && (
                  <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(() => RequestAPI.start(request.id))}>
                    <Play className="w-5 h-5" /> Start work
                  </Button>
                )}
                {action === "complete" && (
                  <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(() => RequestAPI.complete(request.id))}>
                    <Flag className="w-5 h-5" /> Complete work
                  </Button>
                )}
                {action === "collect" && (
                  <div className="space-y-3">
                    <p className="text-center text-sm text-slate-500">Service amount</p>
                    <p className="text-center text-4xl font-black font-display text-slate-900">{formatRupees(amount)}</p>
                    <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(() => RequestAPI.collectPayment(request.id))}>
                      <Wallet className="w-5 h-5" /> Record simulated collection
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {canCancelJob(request.status) && (
              <CancelJobPanel
                worker={worker}
                job={request}
                policy={request.cancelPolicy}
                busy={cancelling}
                onCancel={(reason) => void cancelRequest(reason)}
              />
            )}

            {!worker && request.status === "completed" && request.paymentStatus !== "collected" && (
              <Card padding="lg" className="text-center space-y-2">
                <SimulatedMoneyBanner />
                <p className="text-sm text-slate-500">Simulated job value</p>
                <p className="text-4xl font-black font-display">{formatRupees(amount)}</p>
                <p className="text-sm text-slate-500">No real money moves. Confirm to record the simulated settlement.</p>
                <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(() => RequestAPI.customerComplete(request.id))}>
                  <CheckCircle className="w-5 h-5" /> Confirm completion (simulated)
                </Button>
              </Card>
            )}

            {!worker && request.paymentStatus === "collected" && request.status !== "reviewed" && (
              <div className="space-y-3">
                {!request.customerCompleted && (
                  <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(() => RequestAPI.customerComplete(request.id))}>
                    <CheckCircle className="w-5 h-5" /> Mark request completed
                  </Button>
                )}
              </div>
            )}

            {request.finance?.settled && (
              <Card padding="md" className="space-y-1">
                <SimulatedMoneyBanner />
                <p className="text-sm text-slate-700">Job value ₹{request.finance.jobPriceRupees}</p>
                <p className="text-sm text-slate-700">FixBuddy commission {request.finance.commissionPercent}% = ₹{request.finance.commissionRupees}</p>
                <p className="text-sm text-slate-700">Worker net ₹{request.finance.workerNetRupees}</p>
              </Card>
            )}

            <Card padding="lg">
              <h3 className="font-display font-bold text-slate-900 mb-5 text-lg">Request Timeline</h3>
              {timeline.length === 0 ? (
                <p className="text-base text-slate-500">Timeline updates will appear here.</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((step, i) => (
                    <div key={step.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${step.current ? "bg-sky-600 text-white" : "bg-emerald-500 text-white"}`}>
                          {step.current ? <span className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        {i < timeline.length - 1 && <div className="w-0.5 h-12 mt-1 bg-sky-200" />}
                      </div>
                      <div className="pb-8 last:pb-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-base font-semibold capitalize text-slate-900">{step.label}</p>
                          {step.time && <span className="text-sm text-slate-400">{step.time}</span>}
                        </div>
                        <p className="text-sm mt-1 text-slate-600">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {!!request.photos?.length && (
              <div className="grid grid-cols-2 gap-3">
                {request.photos.map((src) => (
                  <img key={src} src={mediaUrl(src)} alt="" className="h-40 w-full rounded-2xl object-cover bg-slate-100" onError={(e) => { e.currentTarget.src = ""; e.currentTarget.className += " hidden"; }} />
                ))}
              </div>
            )}

            {(request.workPhotos?.before?.length || request.workPhotos?.during?.length || request.workPhotos?.after?.length) ? (
              <Card padding="lg" className="space-y-3">
                <h3 className="font-display font-bold text-slate-900">Proof of work</h3>
                {(["before", "during", "after"] as const).map((stage) => (
                  (request.workPhotos?.[stage] || []).length ? (
                    <div key={stage}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{stage}</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {(request.workPhotos?.[stage] || []).map((src) => (
                          <img key={src} src={mediaUrl(src)} alt="" className="h-24 w-24 rounded-xl object-cover bg-slate-100" />
                        ))}
                      </div>
                    </div>
                  ) : null
                ))}
              </Card>
            ) : null}

            {!["payment_collected", "customer_completed", "reviewed", "cancelled"].includes(request.status) && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full text-center text-sm text-slate-500 font-medium py-3"
                  onClick={() => {
                    void SafetyAPI.report({
                      requestId: request.id,
                      subject: worker ? "Report customer" : "Report worker",
                      body: "Reported from live tracking",
                    })
                      .then(() => setReportMsg("Report submitted to FixBuddy support."))
                      .catch((e: Error) => setReportMsg(e.message));
                  }}
                >
                  {worker ? "Report customer" : "Report worker"}
                </button>
                {reportMsg && <p className="text-xs text-center text-slate-500">{reportMsg}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {showReview && request && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-slate-900">How was your experience with the worker?</h3>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setReviewStars(n)}>
                  <Star className={`w-8 h-8 ${n <= reviewStars ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Write your feedback..." className="w-full rounded-2xl border border-slate-200 p-3 text-sm min-h-24" />
            <Button size="lg" fullWidth loading={!!acting} onClick={() => void run(async () => {
              await RequestAPI.review(request.id, { rating: reviewStars, comment: reviewText });
              setShowReview(false);
            })}>
              Submit Review
            </Button>
            <button type="button" className="w-full text-sm font-semibold text-slate-500" onClick={() => void run(async () => {
              await RequestAPI.review(request.id, { skip: true });
              setShowReview(false);
            })}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
