import React, { useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { View } from "../../types";
import { Card, Avatar, EmptyState } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { ChatAPI, type ReviewsPayload } from "../../api/client";

export default function Reviews({ navigate }: { navigate: (v: View) => void }) {
  const { user, setActiveRequestId } = useApp();
  const { data, loading, error } = useFetch<ReviewsPayload>(user?.id ? `/reviews?providerId=${user.id}` : "/reviews");
  const dist = data?.distribution || [0, 0, 0, 0, 0];
  const total = dist.reduce((s, n) => s + n, 0) || 1;
  const rows = data?.reviews || [];
  const [replyError, setReplyError] = useState("");
  const [busyId, setBusyId] = useState("");

  const reply = async (requestId: string) => {
    if (!requestId) return;
    setBusyId(requestId);
    setReplyError("");
    try {
      await ChatAPI.open(requestId);
      setActiveRequestId(requestId);
      navigate("business-messages");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Customer Reviews</h1>
        <p className="text-slate-500 text-base mt-1">Live ratings from completed jobs — not sample text.</p>
      </div>

      {error && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
      {replyError && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{replyError}</Card>}
      {loading && <Card className="text-sm text-slate-500">Loading reviews...</Card>}

      <Card padding="lg" className="bg-gradient-to-br from-amber-50 to-white border-amber-200 animate-float-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="text-center sm:min-w-[140px]">
            <p className="font-black text-6xl text-amber-600 font-display">{data?.ratingAvg || 0}</p>
            <div className="flex justify-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-6 h-6 ${i <= Math.round(data?.ratingAvg || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
              ))}
            </div>
            <p className="text-sm text-slate-600 font-medium">{data?.ratingCount || 0} reviews</p>
          </div>
          <div className="flex-1 space-y-2.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = dist[stars - 1] || 0;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700 w-4">{stars}</span>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 h-3 bg-amber-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-slate-500 w-16 text-right">{count} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Reviews</p>
        {!loading && rows.length === 0 && (
          <EmptyState icon="⭐" title="No reviews yet" description="When a customer rates a completed job, it will show here." />
        )}
        {rows.map((r, i) => (
          <Card key={r.id} padding="lg" className="hover-lift animate-rise" style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties}>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-sky-50 border border-sky-100 flex-shrink-0">
                {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : <Avatar src="" name={r.customer} size="lg" className="rounded-2xl" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 text-lg">{r.customer}</p>
                  <span className="text-sm text-slate-400">{r.date}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-5 h-5 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-base text-slate-700 leading-relaxed mb-4">{r.comment || "Rated this job without a written comment."}</p>
            <button
              type="button"
              disabled={busyId === r.requestId}
              onClick={() => void reply(r.requestId)}
              className="flex items-center gap-2 text-sm text-sky-700 font-semibold bg-sky-50 hover:bg-sky-100 px-4 py-2.5 rounded-xl disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" /> Reply in chat
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
