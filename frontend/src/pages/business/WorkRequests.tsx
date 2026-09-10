import React, { useState } from "react";
import { MapPin, Clock, DollarSign, CheckCircle, X, Phone, MessageSquare, Play, Flag } from "lucide-react";
import { View } from "../../types";
import { Card, Badge, Button, EmptyState, Skeleton, Input } from "../../components/ui";
import { ChatAPI, RequestAPI, type JobRequest } from "../../api/client";
import { useApp, useFetch } from "../../api/AppContext";
import { startCall } from "../../api/phone";

const OPEN = ["open", "requested", "matching"];
const ACTIVE = ["accepted", "scheduled", "in_progress"];

export default function WorkRequests({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, user } = useApp();
  const { data, loading, error, reload } = useFetch<{ requests: JobRequest[] }>("/requests?inbox=true");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [quotes, setQuotes] = useState<Record<string, string>>({});

  const requests = data?.requests || [];
  const current = requests.filter((r) => ACTIVE.includes(r.status) && (!r.providerId || r.providerId === user?.id));
  const available = requests.filter((r) => OPEN.includes(r.status) && !r.providerId);
  const worker = user?.role === "worker";
  const mustFinish = worker && current.length > 0;

  const act = async (id: string, kind: "accept" | "decline" | "start" | "complete") => {
    setBusy(id);
    setActionError("");
    try {
      if (kind === "accept") await RequestAPI.accept(id);
      else if (kind === "decline") await RequestAPI.decline(id);
      else if (kind === "start") await RequestAPI.start(id);
      else await RequestAPI.complete(id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const sendQuote = async (id: string) => {
    const amount = Number(quotes[id]);
    if (!amount) {
      setActionError("Enter an amount to quote");
      return;
    }
    setBusy(id);
    setActionError("");
    try {
      await RequestAPI.quote(id, amount);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setBusy(null);
    }
  };

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
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {mustFinish ? "Your current job" : worker ? "Available Jobs" : "Jobs & Requests"}
        </h1>
        <p className="text-slate-500 text-sm">
          {mustFinish
            ? "You accepted this job. Finish it first. Other jobs show after you complete it."
            : "Accept a job. Call and chat unlock after you accept."}
        </p>
      </div>
      {actionError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{actionError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-32 w-full" />}

      {!loading && current.length === 0 && available.length === 0 && (
        <EmptyState icon="📥" title="No jobs right now" description="When a customer needs your service, it will show up here." />
      )}

      {current.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">
            Accepted — finish this first
          </p>
          <div className="space-y-4">
            {current.map((req) => (
              <Card key={req.id} padding="md" className="border-emerald-200 ring-1 ring-emerald-100">
                <p className="text-xs font-semibold text-emerald-700 mb-3">You accepted this job</p>
                <JobBody req={req} quotes={quotes} setQuotes={setQuotes} busy={false} hideQuote />
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Do the work</p>
                    {req.status !== "in_progress" ? (
                      <button
                        disabled={busy === req.id}
                        onClick={() => void act(req.id, "start")}
                        className="min-h-12 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Play className="w-5 h-5" /> Start job
                      </button>
                    ) : (
                      <button
                        disabled={busy === req.id}
                        onClick={() => void act(req.id, "complete")}
                        className="min-h-12 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Flag className="w-5 h-5" /> Mark complete
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveRequestId(req.id);
                        navigate("job-details");
                      }}
                      className="min-h-12 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                    >
                      Details
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact customer</p>
                    <button
                      onClick={() => startCall(req.customer?.phone)}
                      className="min-h-12 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-5 h-5" /> Call
                    </button>
                    <button
                      disabled={busy === req.id}
                      onClick={() => void openChat(req.id)}
                      className="min-h-12 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <MessageSquare className="w-5 h-5" /> Message
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {mustFinish && available.length > 0 && (
            <p className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-4">
              {available.length} more job{available.length === 1 ? "" : "s"} waiting. They appear here after you complete the job above.
            </p>
          )}
        </div>
      )}

      {!mustFinish && available.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">New · {available.length}</p>
          <div className="space-y-4">
            {available.map((req) => (
              <Card key={req.id} padding="md">
                <JobBody req={req} quotes={quotes} setQuotes={setQuotes} busy={busy === req.id} onQuote={() => void sendQuote(req.id)} />
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Decide</p>
                    <button
                      disabled={busy === req.id}
                      onClick={() => void act(req.id, "accept")}
                      className="min-h-12 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" /> Accept
                    </button>
                    <button
                      disabled={busy === req.id}
                      onClick={() => void act(req.id, "decline")}
                      className="min-h-12 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" /> Reject
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</p>
                    <button
                      disabled
                      className="min-h-12 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <Phone className="w-5 h-5" /> Call
                    </button>
                    <button
                      disabled={busy === req.id}
                      onClick={() => void openChat(req.id)}
                      className="min-h-12 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <MessageSquare className="w-5 h-5" /> Message
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">Chat is available now. Calls unlock after accept.</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobBody({
  req,
  quotes,
  setQuotes,
  busy,
  onQuote,
  hideQuote,
}: {
  req: JobRequest;
  quotes: Record<string, string>;
  setQuotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  onQuote?: () => void;
  hideQuote?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide mb-1">{req.category}</p>
          <p className="font-semibold text-slate-900">{req.description}</p>
          <p className="text-xs text-slate-500 mt-1">by {req.customer?.name || "Customer"} · {req.code}</p>
        </div>
        <Badge variant={ACTIVE.includes(req.status) ? "success" : "info"}>{req.status.replace("_", " ")}</Badge>
      </div>
      {req.photos?.length ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {req.photos.slice(0, 3).map((src) => (
            <img key={src} src={src} alt="" className="h-24 w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
      {req.voiceNote && <audio controls src={req.voiceNote} className="w-full mb-3" />}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="w-4 h-4 text-sky-500" />
          {req.area || req.city}
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock className="w-4 h-4 text-sky-500" />
          {req.scheduledLabel || req.timing}
        </div>
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold col-span-2">
          <DollarSign className="w-4 h-4 text-sky-500" />
          Customer amount: ₹{req.estimatedAmount || 0}
          {req.workerQuote ? ` · Your quote: ₹${req.workerQuote}` : ""}
        </div>
      </div>
      {!hideQuote && onQuote && (
        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Your quote ₹"
            type="number"
            value={quotes[req.id] || ""}
            onChange={(e) => setQuotes((p) => ({ ...p, [req.id]: e.target.value }))}
          />
          <Button size="lg" variant="secondary" loading={busy} onClick={onQuote}>Send quote</Button>
        </div>
      )}
    </>
  );
}
