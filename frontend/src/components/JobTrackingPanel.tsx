import React from "react";
import { Phone } from "lucide-react";
import { Button, Card } from "./ui";
import LiveTrackMap from "./LiveTrackMap";
import { mediaUrl, type JobRequest } from "../api/client";
import { TRACKING_JOB_STATUSES, statusLabel } from "../api/jobLock";
import type { GpsState } from "../api/useWorkerGps";
import type { RealtimeConnectionState } from "../api/realtime";
import { startCall } from "../api/phone";

const HEADLINE: Record<string, { customer: string; worker: string }> = {
  accepted: { customer: "Worker accepted your request", worker: "On the way to the customer" },
  scheduled: { customer: "Worker accepted your request", worker: "Job is scheduled" },
  on_the_way: { customer: "Worker is on the way", worker: "On the way" },
  arrived: { customer: "Your Fixbuddy worker has arrived", worker: "Arrived — enter customer OTP" },
  otp_verified: { customer: "Worker has started the service", worker: "Work in progress" },
  in_progress: { customer: "Worker has started the service", worker: "Work in progress" },
};

export function isTrackingStatus(status?: string | null) {
  return TRACKING_JOB_STATUSES.includes(String(status || ""));
}

export default function JobTrackingPanel({
  job,
  workerRole,
  gpsState = "idle",
  socketState = "disconnected",
  workerLat,
  workerLng,
  workerLocationAt,
}: {
  job: JobRequest;
  workerRole: boolean;
  gpsState?: GpsState;
  socketState?: RealtimeConnectionState;
  workerLat?: number | null;
  workerLng?: number | null;
  workerLocationAt?: string | number | null;
}) {
  const tracking = isTrackingStatus(job.status);
  const lat = workerLat ?? job.workerLat;
  const lng = workerLng ?? job.workerLng;
  const at = workerLocationAt ?? job.workerLocationAt;
  const stale = Boolean(at && Date.now() - new Date(at).getTime() > 45_000);
  const waiting = tracking && (lat == null || lng == null);
  const headline = HEADLINE[job.status] || { customer: statusLabel(job.status), worker: statusLabel(job.status) };
  const otherName = workerRole ? job.customer?.name || "Customer" : job.provider?.name || "Worker";
  const rating = job.provider?.rating;

  return (
    <div className="space-y-3">
      {socketState === "reconnecting" && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
          Live tracking is reconnecting. Your job is still active.
        </p>
      )}
      {socketState === "disconnected" && tracking && (
        <p className="text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2">
          Live updates paused. We’ll retry automatically.
        </p>
      )}
      {workerRole && gpsState === "denied" && tracking && (
        <Card padding="md" className="space-y-2 border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-950">Location permission is required</p>
          <p className="text-sm text-amber-900">
            Location permission is required while you’re travelling to the customer.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                () => undefined,
                () => undefined
              );
            }}
          >
            Enable Location
          </Button>
        </Card>
      )}
      {workerRole && (gpsState === "unavailable" || gpsState === "unsupported") && tracking && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
          GPS is unavailable right now. The customer will see your last known location.
        </p>
      )}

      {tracking && (
        <LiveTrackMap
          customer={{ lat: job.lat, lng: job.lng }}
          worker={workerRole ? null : { lat, lng }}
          workerRole={workerRole}
          waitingForWorker={waiting && !workerRole}
          stale={stale && !workerRole}
          tapHint={
            workerRole
              ? "Customer house for this job. Stay on this screen."
              : "Watch the worker live in FixBuddy. No need to open another map."
          }
        />
      )}

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">{workerRole ? headline.worker : headline.customer}</p>
          {tracking && lat != null && !stale && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live location
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
            {(workerRole ? job.customer?.avatar : job.provider?.avatar) ? (
              <img
                src={mediaUrl((workerRole ? job.customer?.avatar : job.provider?.avatar) || "")}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-lg">{otherName.slice(0, 1)}</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{otherName}</p>
            <p className="text-sm text-slate-500">
              {job.category}
              {!workerRole && rating != null ? ` · ⭐ ${rating}` : ""}
              {job.provider?.verified && !workerRole ? " · Verified" : ""}
            </p>
            {workerRole && <p className="text-xs text-slate-500 truncate">{job.address || job.area || job.city}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">ETA</p>
            <p className="font-bold">{job.etaMinutes ? `${job.etaMinutes} min` : "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Distance</p>
            <p className="font-bold">{job.distanceKm != null ? `${job.distanceKm} km` : "—"}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => startCall(workerRole ? job.customer?.phone : job.provider?.phone)}
          >
            <Phone className="w-4 h-4" /> {workerRole ? "Call customer" : "Call worker"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
