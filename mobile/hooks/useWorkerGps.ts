import { useEffect } from "react";
import * as Location from "expo-location";
import { RequestAPI } from "../services/requests";
import { isTrackingStatus } from "../utils/jobStatus";

export function useWorkerGps(jobId: string | undefined, status: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !jobId || !isTrackingStatus(status)) return;
    let stopped = false;
    let sub: Location.LocationSubscription | null = null;
    let lastSent = 0;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (stopped || perm.status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 2500, distanceInterval: 12 },
        (pos) => {
          const now = Date.now();
          if (now - lastSent < 2000) return;
          lastSent = now;
          void RequestAPI.pingLocation(jobId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
      );
    })();
    return () => {
      stopped = true;
      sub?.remove();
    };
  }, [enabled, jobId, status]);
}
