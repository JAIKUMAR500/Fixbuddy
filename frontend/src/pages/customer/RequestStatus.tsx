import React from "react";
import { ArrowLeft, MapPin, Clock, Phone, MessageSquare, CheckCircle, Circle } from "lucide-react";
import { View } from "../../types";
import { Button, Card, RatingStars, Avatar } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { RequestAPI, ChatAPI, type JobRequest } from "../../api/client";
import { isBusiness } from "../../api/roles";
import { startCall, jobAllowsCall } from "../../api/phone";

export default function RequestStatus({ navigate }: { navigate: (v: View) => void }) {
  const { activeRequestId, setActiveRequestId, user } = useApp();
  const { data, loading, error, reload } = useFetch<{ request: JobRequest }>(activeRequestId ? `/requests/${activeRequestId}` : null);
  const [cancelling, setCancelling] = React.useState(false);
  const [acting, setActing] = React.useState("");
  const request = data?.request;
  const provider = request?.provider;
  const worker = user?.role === "worker";
  const backView = user?.role === "customer" ? "my-requests" : "my-jobs";
  const callPhone = worker ? request?.customer?.phone : provider?.phone;
  const statuses = ["matching", "open", "requested", "accepted", "scheduled", "in_progress", "completed", "reviewed"];
  const currentIndex = request ? Math.max(0, statuses.indexOf(request.status)) : -1;

  const cancelRequest = async () => {
    if (!activeRequestId) return;
    setCancelling(true);
    try {
      await RequestAPI.cancel(activeRequestId);
      navigate(backView);
    } finally {
      setCancelling(false);
    }
  };

  const [openingChat, setOpeningChat] = React.useState(false);
  const [chatError, setChatError] = React.useState("");

  const openChat = async () => {
    if (!activeRequestId || !provider) return;
    setOpeningChat(true);
    setChatError("");
    try {
      await ChatAPI.open(activeRequestId);
      setActiveRequestId(activeRequestId);
      navigate(worker || isBusiness(user?.role) ? "business-messages" : "customer-messages");
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setOpeningChat(false);
    }
  };

  const timeline = request?.timeline?.length
    ? request.timeline.map((item, i) => ({
        id: `${item.status}-${i}`,
        label: item.status.replaceAll("_", " "),
        desc: item.note,
        time: item.at ? new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "",
        done: i <= currentIndex || currentIndex === -1,
        current: i === request.timeline.length - 1,
      }))
    : [];

  return (
    <div className="min-h-screen bg-sky-50 animate-fade-in">
      <header className="sticky top-0 z-10 bg-white border-b border-sky-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(backView)} className="p-3 rounded-xl hover:bg-sky-50 min-w-11 min-h-11">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div>
            <h1 className="font-display font-bold text-slate-900 text-lg sm:text-xl">Request Status</h1>
            <p className="text-sm text-slate-500">{request?.code || "Request details"} · {request?.category || "Service request"}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-24">
        {!activeRequestId && <Card className="text-base text-slate-600">Open a request from My Requests to track it.</Card>}
        {loading && <Card className="text-base text-slate-500">Loading request status...</Card>}
        {error && <Card className="border-red-200 bg-red-50 text-base text-red-700">{error}</Card>}
        {chatError && <Card className="border-red-200 bg-red-50 text-base text-red-700">{chatError}</Card>}

        {request && (
          <>
            <div className="bg-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg animate-float-in">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 bg-emerald-300 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-sky-100 uppercase tracking-wide">{request.status.replaceAll("_", " ")}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">{request.category}</h2>
              <p className="text-sky-50 text-base mb-4 leading-relaxed">{request.description}</p>
              <div className="flex flex-wrap gap-4 text-sky-50 text-base">
                <span className="flex items-center gap-2"><Clock className="w-5 h-5" />{request.scheduledLabel || request.timing || "Pending schedule"}</span>
                <span className="flex items-center gap-2"><MapPin className="w-5 h-5" />{request.area || request.city || "Your area"}</span>
              </div>
            </div>

            <Card padding="lg" className="hover-lift">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-sky-100 bg-sky-50 flex-shrink-0">
                  {provider?.avatar ? (
                    <img src={provider.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar src="" name={provider?.name || "Provider"} size="xl" className="rounded-2xl w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-lg">{provider?.name || "Waiting for a worker"}</h3>
                  {provider ? <RatingStars value={provider.rating} count={provider.reviews} /> : <p className="text-sm text-slate-500 mt-1">No worker assigned yet</p>}
                </div>
                {provider && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={openingChat}
                      onClick={() => void openChat()}
                      className="px-4 min-h-12 bg-sky-600 text-white rounded-xl hover:bg-sky-700 font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      <MessageSquare className="w-5 h-5" /> Message
                    </button>
                    {jobAllowsCall(request.status) && (
                      <button
                        type="button"
                        onClick={() => startCall(callPhone)}
                        className="px-4 min-h-12 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold flex items-center gap-2"
                        title="Call"
                      >
                        <Phone className="w-5 h-5" /> Call
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card padding="lg">
              <h3 className="font-display font-bold text-slate-900 mb-5 text-lg">Request Timeline</h3>
              {timeline.length === 0 ? (
                <p className="text-base text-slate-500">Timeline updates will appear here.</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((step, i) => (
                    <div key={step.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${step.done && step.current
                            ? "bg-sky-600 text-white shadow-md shadow-sky-200"
                            : step.done
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}>
                          {step.done && !step.current ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : step.current ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </div>
                        {i < timeline.length - 1 && (
                          <div className={`w-0.5 h-12 mt-1 ${step.done ? "bg-sky-200" : "bg-slate-100"}`} />
                        )}
                      </div>
                      <div className="pb-8 last:pb-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-base font-semibold capitalize ${step.done ? "text-slate-900" : "text-slate-400"} ${step.current ? "text-sky-700" : ""}`}>
                            {step.label}
                          </p>
                          {step.time && <span className="text-sm text-slate-400">{step.time}</span>}
                        </div>
                        <p className={`text-sm mt-1 ${step.done ? "text-slate-600" : "text-slate-300"}`}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="lg">
              <h3 className="font-display font-bold text-slate-900 mb-4 text-lg">Request Details</h3>
              <div className="space-y-1">
                {[
                  { label: "Problem", value: request.description || "—" },
                  { label: "Category", value: request.category || "—" },
                  { label: "Location", value: [request.address, request.area, request.city].filter(Boolean).join(", ") || "—" },
                  { label: "Scheduled", value: request.scheduledLabel || request.timing || "Pending" },
                  { label: "Your amount", value: request.estimatedAmount ? `₹${request.estimatedAmount}` : "Not set" },
                  { label: "Worker quote", value: request.workerQuote ? `₹${request.workerQuote}` : "Waiting" },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 py-3 border-b border-sky-50 last:border-0">
                    <span className="text-sm text-slate-500">{r.label}</span>
                    <span className="text-base font-semibold text-slate-800 sm:text-right">{r.value}</span>
                  </div>
                ))}
              </div>
              {request.voiceNote && <audio controls src={request.voiceNote} className="w-full mt-4" />}
              {!!request.photos?.length && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {request.photos.map((src) => (
                    <img key={src} src={src} alt="" className="h-48 w-full rounded-2xl object-cover" />
                  ))}
                </div>
              )}
            </Card>

            {worker && request.providerId === user?.id && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {["accepted", "open", "requested"].includes(request.status) && (
                  <Button size="lg" loading={acting === "schedule"} onClick={async () => {
                    if (!activeRequestId) return;
                    setActing("schedule");
                    try { await RequestAPI.schedule(activeRequestId, { scheduledLabel: "Starting now" }); reload(); } finally { setActing(""); }
                  }}>Set start time</Button>
                )}
                {["accepted", "scheduled"].includes(request.status) && (
                  <Button size="lg" loading={acting === "start"} onClick={async () => {
                    if (!activeRequestId) return;
                    setActing("start");
                    try { await RequestAPI.start(activeRequestId); reload(); } finally { setActing(""); }
                  }}>Start work</Button>
                )}
                {request.status === "in_progress" && (
                  <Button size="lg" loading={acting === "complete"} onClick={async () => {
                    if (!activeRequestId) return;
                    setActing("complete");
                    try { await RequestAPI.complete(activeRequestId); reload(); } finally { setActing(""); }
                  }}>Mark complete</Button>
                )}
              </div>
            )}

            <button onClick={() => void cancelRequest()} disabled={cancelling || !activeRequestId} className="w-full text-center text-base text-red-500 font-medium py-4 min-h-12 rounded-xl border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50">
              {cancelling ? "Cancelling..." : "Cancel Request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
