import React, { useEffect, useRef } from "react";

type Point = { lat: number; lng: number; label: string; color: string };

function loadLeaflet(): Promise<typeof window & { L: any }> {
  const w = window as typeof window & { L?: any };
  if (w.L) return Promise.resolve(w as typeof window & { L: any });
  return new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.setAttribute("data-leaflet", "1");
      document.head.appendChild(css);
    }
    const existing = document.querySelector("script[data-leaflet]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window as typeof window & { L: any }));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-leaflet", "1");
    script.onload = () => resolve(window as typeof window & { L: any });
    script.onerror = () => reject(new Error("Could not load map"));
    document.body.appendChild(script);
  });
}

export default function TrackMap({
  customer,
  worker,
  className = "",
}: {
  customer?: { lat?: number | null; lng?: number | null } | null;
  worker?: { lat?: number | null; lng?: number | null } | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>(null);

  useEffect(() => {
    const points: Point[] = [];
    if (customer?.lat != null && customer?.lng != null) {
      points.push({ lat: customer.lat, lng: customer.lng, label: "Service location", color: "#0284c7" });
    }
    if (worker?.lat != null && worker?.lng != null) {
      points.push({ lat: worker.lat, lng: worker.lng, label: "Worker", color: "#059669" });
    }
    if (!points.length || !ref.current) return;
    let cancelled = false;
    void loadLeaflet().then((w) => {
      if (cancelled || !ref.current) return;
      const L = w.L;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: false }).setView([points[0].lat, points[0].lng], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        }).addTo(mapRef.current);
        layersRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const layers = layersRef.current;
      layers.clearLayers();
      const markers = points.map((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 10, color: p.color, fillColor: p.color, fillOpacity: 0.9 }).bindPopup(p.label).addTo(layers)
      );
      if (points.length === 2) {
        L.polyline(
          points.map((p) => [p.lat, p.lng]),
          { color: "#0ea5e9", weight: 4, opacity: 0.8 }
        ).addTo(layers);
      }
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.35));
    });
    return () => {
      cancelled = true;
    };
  }, [customer?.lat, customer?.lng, worker?.lat, worker?.lng]);

  if ((customer?.lat == null || customer?.lng == null) && (worker?.lat == null || worker?.lng == null)) {
    return (
      <div className={`rounded-2xl bg-slate-100 border border-slate-200 h-56 flex items-center justify-center text-sm text-slate-500 ${className}`}>
        Location will appear when GPS is available.
      </div>
    );
  }

  return <div ref={ref} className={`rounded-2xl overflow-hidden h-56 w-full border border-slate-200 ${className}`} />;
}
