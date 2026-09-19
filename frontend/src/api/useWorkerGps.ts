import { useEffect, useState } from "react";
import { TRACKING_JOB_STATUSES } from "./jobLock";
import { RequestAPI } from "./client";
import { publishWorkerLocation } from "./realtime";

export type GpsState = "idle" | "live" | "denied" | "unavailable" | "unsupported";

export function useWorkerGps(jobId: string | undefined, status: string | undefined, enabled: boolean) {
  const [state, setState] = useState<GpsState>("idle");

  useEffect(() => {
    if (!enabled || !jobId || !TRACKING_JOB_STATUSES.includes(String(status || ""))) {
      setState("idle");
      return;
    }
    if (!navigator.geolocation) {
      setState("unsupported");
      return;
    }
    let lastSent = 0;
    let watch = 0;
    let stopped = false;
    const geo = navigator.geolocation;
    let lastLat = 0;
    let lastLng = 0;
    const onOk = (pos: GeolocationPosition) => {
      const now = Date.now();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const moved =
        lastSent === 0
          ? 999
          : Math.hypot((lat - lastLat) * 111_000, (lng - lastLng) * 111_000 * Math.cos((lat * Math.PI) / 180));
      if (now - lastSent < 2000 && moved < 12) return;
      lastSent = now;
      lastLat = lat;
      lastLng = lng;
      setState("live");
      publishWorkerLocation(jobId, lat, lng);
      void RequestAPI.pingLocation(jobId, lat, lng).catch(() => {});
    };
    const startWatch = (highAccuracy: boolean) =>
      geo.watchPosition(
        onOk,
        (err) => {
          if (stopped) return;
          if (err.code === 1) {
            setState("denied");
            return;
          }
          if (highAccuracy) {
            geo.clearWatch(watch);
            watch = startWatch(false);
            return;
          }
          setState("unavailable");
        },
        highAccuracy
          ? { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
          : { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 }
      );
    geo.getCurrentPosition?.(onOk, () => undefined, { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 });
    watch = startWatch(true);
    return () => {
      stopped = true;
      geo.clearWatch(watch);
    };
  }, [enabled, jobId, status]);

  return state;
}
