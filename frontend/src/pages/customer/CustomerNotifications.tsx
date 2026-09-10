import React from "react";
import { CheckCircle, MessageSquare, Bell, Star } from "lucide-react";
import { View } from "../../types";
import { EmptyState, Skeleton } from "../../components/ui";
import { NotifAPI, type AppNotif } from "../../api/client";
import { useApp, useFetch } from "../../api/AppContext";

const icons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  info: <Bell className="w-4 h-4 text-sky-600" />,
  message: <MessageSquare className="w-4 h-4 text-blue-600" />,
  review: <Star className="w-4 h-4 text-amber-500" />,
  request: <Bell className="w-4 h-4 text-sky-600" />,
};

const iconBg: Record<string, string> = {
  success: "bg-emerald-50",
  info: "bg-sky-50",
  message: "bg-blue-50",
  review: "bg-amber-50",
  request: "bg-sky-50",
};

export default function CustomerNotifications({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, user } = useApp();
  const { data, loading, error, reload } = useFetch<{ unread: number; notifications: AppNotif[] }>("/notifications");
  const notifs = data?.notifications || [];

  const markAllRead = async () => {
    await NotifAPI.read();
    reload();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Notifications</h1>
        <button onClick={() => void markAllRead()} className="text-sm text-sky-600 font-medium hover:text-sky-700">
          Mark all read
        </button>
      </div>
      {loading && <Skeleton className="h-20 w-full" />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && notifs.length === 0 && (
        <EmptyState icon="🔔" title="No notifications" description="Updates about your requests will appear here." />
      )}
      <div className="space-y-2">
        {notifs.map((n) => (
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              void NotifAPI.read([n.id]);
              if (n.type === "message") {
                navigate(user?.role === "customer" ? "customer-messages" : "business-messages");
                return;
              }
              if (n.type === "review") {
                navigate(user?.role === "customer" ? "customer-reviews" : "reviews");
                return;
              }
              if (n.requestId) {
                setActiveRequestId(n.requestId);
                navigate(user?.role === "customer" ? "request-status" : "job-details");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLElement).click();
            }}
            className={`flex items-start gap-3 rounded-2xl p-4 border cursor-pointer ${n.read ? "bg-white border-sky-100" : "bg-sky-50 border-sky-200"}`}
          >
            <span className={`p-2 rounded-xl flex-shrink-0 ${iconBg[n.type] || "bg-sky-50"}`}>{icons[n.type] || icons.info}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.read ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.text}</p>
              <p className="text-xs text-slate-500 mt-0.5">{n.time}</p>
            </div>
            {!n.read && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}
