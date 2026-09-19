import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type Point = { lat?: number | null; lng?: number | null } | null | undefined;
type LatLng = { lat: number; lng: number };

function valid(point: Point): LatLng | null {
  return point?.lat != null && point?.lng != null && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    ? { lat: point.lat, lng: point.lng }
    : null;
}

function lngToTile(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTile(lat: number, zoom: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** zoom;
}

function metersBetween(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function LiveTrackMap({
  customer,
  worker,
  workerRole = false,
}: {
  customer?: Point;
  worker?: Point;
  workerRole?: boolean;
}) {
  const house = valid(customer);
  const live = workerRole ? null : valid(worker);
  const [size, setSize] = useState({ w: 320, h: 280 });
  const points = [house, live].filter(Boolean) as LatLng[];
  const view = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const center = {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
    const latSpan = Math.max(Math.max(...lats) - Math.min(...lats), 0.002) + 0.003;
    const lngSpan = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.002) + 0.003;
    let zoom = 15;
    for (let z = 17; z >= 12; z -= 1) {
      const pxW = Math.abs(lngToTile(center.lng + lngSpan / 2, z) - lngToTile(center.lng - lngSpan / 2, z)) * 256;
      const pxH = Math.abs(latToTile(center.lat - latSpan / 2, z) - latToTile(center.lat + latSpan / 2, z)) * 256;
      zoom = z;
      if (pxW < size.w * 0.72 && pxH < size.h * 0.72) break;
    }
    return { center, zoom };
  }, [house?.lat, house?.lng, live?.lat, live?.lng, size.w, size.h]);

  const tiles = useMemo(() => {
    if (!view) return [];
    const cx = lngToTile(view.center.lng, view.zoom);
    const cy = latToTile(view.center.lat, view.zoom);
    const max = 2 ** view.zoom;
    const list: { key: string; left: number; top: number; src: string }[] = [];
    const x0 = Math.floor(cx - size.w / 2 / 256) - 1;
    const x1 = Math.ceil(cx + size.w / 2 / 256) + 1;
    const y0 = Math.floor(cy - size.h / 2 / 256) - 1;
    const y1 = Math.ceil(cy + size.h / 2 / 256) + 1;
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        if (y < 0 || y >= max) continue;
        const tx = ((x % max) + max) % max;
        list.push({
          key: `${view.zoom}-${tx}-${y}`,
          left: (x - cx) * 256 + size.w / 2,
          top: (y - cy) * 256 + size.h / 2,
          src: `https://basemaps.cartocdn.com/rastertiles/voyager/${view.zoom}/${tx}/${y}.png`,
        });
      }
    }
    return list;
  }, [view, size.w, size.h]);

  const pixel = (point: LatLng) => {
    if (!view) return { x: 0, y: 0 };
    return {
      x: (lngToTile(point.lng, view.zoom) - lngToTile(view.center.lng, view.zoom)) * 256 + size.w / 2,
      y: (latToTile(point.lat, view.zoom) - latToTile(view.center.lat, view.zoom)) * 256 + size.h / 2,
    };
  };

  const gap = house && live ? metersBetween(live, house) : 0;
  const [route, setRoute] = useState<LatLng[]>([]);
  useEffect(() => {
    if (workerRole || !house || !live || gap < 40) {
      setRoute([]);
      return;
    }
    let cancelled = false;
    const url = `https://router.project-osrm.org/route/v1/driving/${live.lng},${live.lat};${house.lng},${house.lat}?overview=full&geometries=geojson`;
    void fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (cancelled || !Array.isArray(coords) || coords.length < 2) return;
        setRoute(coords.map(([lng, lat]) => ({ lat, lng })));
      })
      .catch(() => {
        if (!cancelled) setRoute([live, house]);
      });
    return () => {
      cancelled = true;
    };
  }, [workerRole, house?.lat, house?.lng, live?.lat, live?.lng, gap]);

  const status = workerRole
    ? "Customer house for this job"
    : !live
      ? "Waiting for the worker’s live location"
      : gap < 40
        ? "Worker is at the job location"
        : `Watching live in FixBuddy · ${formatDistance(gap)} away`;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.kicker}>{workerRole ? "JOB LOCATION" : "LIVE TRACKING"}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      <View style={styles.map} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {tiles.map((tile) => (
          <Image key={tile.key} source={{ uri: tile.src }} style={[styles.tile, { left: tile.left, top: tile.top }]} />
        ))}
        {route.map((point, i) => {
          if (!view || i % 4 !== 0) return null;
          const p = pixel(point);
          return <View key={`r-${i}`} style={[styles.routeDot, { left: p.x - 3, top: p.y - 3 }]} />;
        })}
        {house && view ? (
          <View style={[styles.pin, { left: pixel(house).x - 10, top: pixel(house).y - 28 }]}>
            <Text style={styles.pinLabel}>{workerRole ? "House" : "You"}</Text>
            <View style={styles.houseDot} />
          </View>
        ) : null}
        {live && view ? (
          <View style={[styles.pin, { left: pixel(live).x - 11, top: pixel(live).y - 11 }]}>
            <View style={styles.workerDot} />
            <Text style={styles.pinLabel}>Worker</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  head: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 4 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: "#64748B" },
  status: { fontWeight: "700", color: "#0F172A" },
  map: { height: 280, backgroundColor: "#DBE7D3", overflow: "hidden" },
  tile: { position: "absolute", width: 256, height: 256 },
  pin: { position: "absolute", alignItems: "center" },
  pinLabel: { backgroundColor: "#fff", fontSize: 11, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  houseDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#16A34A", borderWidth: 3, borderColor: "#fff", marginTop: 4 },
  workerDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#1D4ED8", borderWidth: 3, borderColor: "#fff" },
  routeDot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#2563EB" },
});
