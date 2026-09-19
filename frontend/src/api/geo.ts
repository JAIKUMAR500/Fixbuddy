export type GeoPlace = {
  lat: number;
  lng: number;
  address: string;
  area: string;
  city: string;
};

export async function reverseGeocode(lat: number, lng: number): Promise<Omit<GeoPlace, "lat" | "lng">> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { Accept: "application/json" } }
  );
  const geo = await res.json();
  const a = geo.address || {};
  return {
    address: geo.display_name || "",
    area: a.suburb || a.neighbourhood || a.village || a.county || "",
    city: a.city || a.town || a.state_district || a.state || "",
  };
}

type GeoErrorLike = { code?: number; message?: string } | null | undefined;

export function gpsErrorMessage(err?: GeoErrorLike) {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "This browser only shares location on localhost or HTTPS. Open http://localhost:5173 or type the address.";
  }
  const code = Number(err?.code);
  if (code === 1) return "Location permission was blocked. Allow location for this site, or type the address.";
  if (code === 3) return "GPS timed out. Try again near a window, or type the address.";
  if (code === 2) return "GPS is unavailable on this device. Type the address instead.";
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return "This device cannot share location. Type the service address instead.";
  }
  return "Could not read GPS. Type the address instead.";
}

function getPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function readGps(): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error(gpsErrorMessage());
  }
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    throw new Error(gpsErrorMessage());
  }
  try {
    // Network/Wi-Fi location first — desktops often have no GPS hardware.
    return await getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 });
  } catch (first) {
    try {
      return await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch (second) {
      throw new Error(gpsErrorMessage((second as GeoErrorLike) || (first as GeoErrorLike)));
    }
  }
}

export function hasCoords(
  point?: { lat?: number | null; lng?: number | null } | null
): point is { lat: number; lng: number } {
  return point?.lat != null && point?.lng != null && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

export function mapsNavUrl(
  dest: { lat: number; lng: number },
  origin?: { lat?: number | null; lng?: number | null } | null
) {
  const d = `${dest.lat},${dest.lng}`;
  if (hasCoords(origin)) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${d}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=driving`;
}

export function openMapsNav(
  dest: { lat: number; lng: number },
  origin?: { lat?: number | null; lng?: number | null } | null
) {
  const url = mapsNavUrl(dest, origin);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

export type LatLng = { lat: number; lng: number };

export function metersBetween(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const routeCache = new Map<string, LatLng[]>();

/** Driving path between two live points. Falls back to a straight line if routing is down. */
export async function fetchDrivingRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  if (metersBetween(from, to) < 40) return [];
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return [from, to];
  const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return [from, to];
  const path = coords.map(([lng, lat]) => ({ lat, lng }));
  routeCache.set(key, path);
  if (routeCache.size > 40) {
    const first = routeCache.keys().next().value;
    if (first) routeCache.delete(first);
  }
  return path;
}

export async function capturePlace(): Promise<GeoPlace> {
  const pos = await readGps();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  try {
    const place = await reverseGeocode(lat, lng);
    return { lat, lng, ...place };
  } catch {
    return { lat, lng, address: "", area: "", city: "" };
  }
}
