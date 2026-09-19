import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Chip, Paper, Typography } from "@mui/material";
import { fetchDrivingRoute, formatDistance, metersBetween, type LatLng } from "../api/geo";

type Point = { lat?: number | null; lng?: number | null } | null | undefined;

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

function fitView(points: LatLng[], width: number, height: number) {
  const pad = 0.0016;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const latSpan = Math.max(Math.max(...lats) - Math.min(...lats), 0.002) + pad * 2;
  const lngSpan = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.002) + pad * 2;
  const minLat = midLat - latSpan / 2;
  const maxLat = midLat + latSpan / 2;
  const minLng = midLng - lngSpan / 2;
  const maxLng = midLng + lngSpan / 2;
  const center = { lat: midLat, lng: midLng };
  let zoom = 15;
  for (let z = 17; z >= 12; z -= 1) {
    const pxW = Math.abs(lngToTile(maxLng, z) - lngToTile(minLng, z)) * 256;
    const pxH = Math.abs(latToTile(minLat, z) - latToTile(maxLat, z)) * 256;
    zoom = z;
    if (pxW < width * 0.72 && pxH < height * 0.72) break;
  }
  if (points.length === 1) zoom = Math.min(16, Math.max(zoom, 15));
  return { center, zoom };
}

function toPixel(point: LatLng, center: LatLng, zoom: number, width: number, height: number) {
  return {
    x: (lngToTile(point.lng, zoom) - lngToTile(center.lng, zoom)) * 256 + width / 2,
    y: (latToTile(point.lat, zoom) - latToTile(center.lat, zoom)) * 256 + height / 2,
  };
}

function tilesFor(center: LatLng, zoom: number, width: number, height: number) {
  const cx = lngToTile(center.lng, zoom);
  const cy = latToTile(center.lat, zoom);
  const max = 2 ** zoom;
  const x0 = Math.floor(cx - width / 2 / 256) - 1;
  const x1 = Math.ceil(cx + width / 2 / 256) + 1;
  const y0 = Math.floor(cy - height / 2 / 256) - 1;
  const y1 = Math.ceil(cy + height / 2 / 256) + 1;
  const tiles: { key: string; left: number; top: number; src: string }[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (y < 0 || y >= max) continue;
      const tx = ((x % max) + max) % max;
      tiles.push({
        key: `${zoom}-${tx}-${y}`,
        left: (x - cx) * 256 + width / 2,
        top: (y - cy) * 256 + height / 2,
        src: `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${y}.png`,
      });
    }
  }
  return tiles;
}

function simplifyPixels(pts: { x: number; y: number }[]) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = out[out.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= 3) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export default function LiveTrackMap({
  customer,
  worker,
  waitingForWorker = false,
  stale = false,
  tapHint,
  workerRole = false,
}: {
  customer?: Point;
  worker?: Point;
  waitingForWorker?: boolean;
  stale?: boolean;
  tapHint?: string;
  navigateTo?: Point;
  origin?: Point;
  workerRole?: boolean;
}) {
  const customerPoint = valid(customer);
  const workerPoint = workerRole ? null : valid(worker);
  const dest = customerPoint || workerPoint;
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 320 });
  const [route, setRoute] = useState<LatLng[]>([]);
  const [trail, setTrail] = useState<LatLng[]>([]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => setSize({ w: Math.max(el.clientWidth, 280), h: Math.max(el.clientHeight, 240) });
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!workerPoint) return;
    setTrail((prev) => {
      const last = prev[prev.length - 1];
      if (last && metersBetween(last, workerPoint) < 10) return prev;
      const next = [...prev, workerPoint];
      return next.length > 90 ? next.slice(-90) : next;
    });
  }, [workerPoint?.lat, workerPoint?.lng]);

  const points = useMemo(
    () => [customerPoint, workerPoint].filter(Boolean) as LatLng[],
    [customerPoint?.lat, customerPoint?.lng, workerPoint?.lat, workerPoint?.lng]
  );
  const view = useMemo(() => (points.length ? fitView(points, size.w, size.h) : null), [points, size.w, size.h]);
  const tiles = useMemo(() => (view ? tilesFor(view.center, view.zoom, size.w, size.h) : []), [view, size.w, size.h]);
  const gap = customerPoint && workerPoint ? metersBetween(workerPoint, customerPoint) : 0;
  const near = Boolean(customerPoint && workerPoint && gap < 40);

  useEffect(() => {
    if (workerRole || !customerPoint || !workerPoint || near) {
      setRoute([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchDrivingRoute(workerPoint, customerPoint)
        .then((path) => {
          if (!cancelled) setRoute(path.length ? path : [workerPoint, customerPoint]);
        })
        .catch(() => {
          if (!cancelled) setRoute([workerPoint, customerPoint]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workerRole, near, customerPoint?.lat, customerPoint?.lng, workerPoint?.lat, workerPoint?.lng]);

  const pixel = (point: LatLng) => (view ? toPixel(point, view.center, view.zoom, size.w, size.h) : { x: 0, y: 0 });
  const routeD = simplifyPixels(route.map((p) => pixel(p)));
  const trailD = simplifyPixels(trail.map((p) => pixel(p)));
  const customerLabel = workerRole ? "House" : "You";
  const workerPx = workerPoint ? pixel(workerPoint) : null;
  const workerLeft = workerPx ? workerPx.x - (near ? 28 : 0) : 0;
  const workerTop = workerPx ? workerPx.y : 0;
  const statusText = workerRole
    ? tapHint || "Customer house for this job"
    : !workerPoint
      ? tapHint || "Watching live in FixBuddy"
      : near
        ? "Worker is at the job location."
        : `Watching live in FixBuddy · ${formatDistance(gap)} away`;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 3 }} data-testid="live-track-map">
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2, lineHeight: 1.2 }}>
          {workerRole ? "Job location" : "Live tracking"}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75 }}>
          {customerPoint && <Chip size="small" color="info" label={customerLabel} />}
          {workerPoint && <Chip size="small" color="success" label="Worker" />}
        </Box>
      </Box>
      <Box
        ref={boxRef}
        data-testid="map-tiles"
        sx={{
          position: "relative",
          height: { xs: 300, sm: 360, md: 420 },
          overflow: "hidden",
          bgcolor: "#dbe7d3",
        }}
      >
        {tiles.map((tile) => (
          <Box
            key={tile.key}
            component="img"
            alt=""
            src={tile.src}
            referrerPolicy="no-referrer"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.dataset.fallback) return;
              img.dataset.fallback = "1";
              const [, tx, ty] = tile.key.split("-");
              img.src = `https://tile.openstreetmap.org/${view?.zoom || 15}/${tx}/${ty}.png`;
            }}
            sx={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: 256,
              height: 256,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        ))}
        {trailD.length > 1 && (
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <polyline
              fill="none"
              stroke="#93c5fd"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={trailD.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        )}
        {routeD.length > 1 && (
          <svg data-testid="track-route" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <polyline
              fill="none"
              stroke="#1d4ed8"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={routeD.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            <polyline
              fill="none"
              stroke="#60a5fa"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={routeD.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        )}
        {customerPoint && view && (
          <Box
            data-testid="marker-customer"
            sx={{
              position: "absolute",
              left: pixel(customerPoint).x,
              top: pixel(customerPoint).y,
              transform: "translate(-50%, -100%)",
              zIndex: 2,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                bgcolor: "#fff",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 800,
                px: 0.9,
                py: 0.25,
                borderRadius: 1.5,
                boxShadow: "0 2px 8px rgba(15,23,42,0.18)",
                mb: 0.4,
                whiteSpace: "nowrap",
              }}
            >
              {customerLabel}
            </Box>
            <Box sx={{ width: 2, height: 10, bgcolor: "#0f172a", mx: "auto" }} />
            <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "#16a34a", border: "3px solid #fff", mx: "auto", boxShadow: "0 2px 8px rgba(22,163,74,0.45)" }} />
          </Box>
        )}
        {workerPoint && view && workerPx && (
          <Box
            data-testid="marker-worker"
            sx={{
              position: "absolute",
              left: workerLeft,
              top: workerTop,
              transform: "translate(-50%, -50%)",
              zIndex: 3,
              textAlign: "center",
              pointerEvents: "none",
              transition: "left 0.6s ease, top 0.6s ease",
            }}
          >
            <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#1d4ed8", border: "3px solid #fff", boxShadow: "0 0 0 8px rgba(29,78,216,0.22)", mx: "auto" }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#0f172a", mt: 0.75, textShadow: "0 1px 2px #fff" }}>
              Worker
            </Typography>
          </Box>
        )}
        {waitingForWorker && !workerPoint && (
          <Alert severity="info" sx={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 4 }}>
            Waiting for the worker’s live location.
          </Alert>
        )}
        {stale && workerPoint && (
          <Alert severity="warning" sx={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 4 }}>
            Worker location is temporarily unavailable. We’ll update this map when GPS returns.
          </Alert>
        )}
        {!dest && (
          <Alert severity="info" sx={{ position: "absolute", left: 12, right: 12, top: "40%", zIndex: 4 }}>
            Location will appear here once GPS is available for this job.
          </Alert>
        )}
        <Typography sx={{ position: "absolute", right: 8, bottom: 6, fontSize: 9, color: "#475569", zIndex: 4, textShadow: "0 1px 2px #fff" }}>
          © OpenStreetMap
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} data-testid="live-watch-status">
          {statusText}
        </Typography>
      </Box>
    </Paper>
  );
}
