import { afterEach, describe, expect, it, vi } from "vitest";
import { gpsErrorMessage, readGps, fetchDrivingRoute } from "./geo";

describe("gpsErrorMessage", () => {
  it("explains permission, timeout, and missing hardware", () => {
    expect(gpsErrorMessage({ code: 1 })).toMatch(/permission/i);
    expect(gpsErrorMessage({ code: 3 })).toMatch(/timed out/i);
    expect(gpsErrorMessage({ code: 2 })).toMatch(/unavailable/i);
  });
});

describe("readGps", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to a coarser location when high-accuracy GPS is missing", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({
        coords: { latitude: 11.01, longitude: 76.95, accuracy: 80, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const pos = await readGps();
    expect(pos.coords.latitude).toBe(11.01);
    expect(getCurrentPosition).toHaveBeenCalled();
  });
});

describe("fetchDrivingRoute", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the driving path from the router", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          routes: [{ geometry: { coordinates: [[77.6, 12.9], [77.61, 12.91]] } }],
        }),
      }))
    );
    const path = await fetchDrivingRoute({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.61 });
    expect(path).toEqual([
      { lat: 12.9, lng: 77.6 },
      { lat: 12.91, lng: 77.61 },
    ]);
  });

  it("skips routing when the two points are already together", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const path = await fetchDrivingRoute({ lat: 11.0168, lng: 76.9558 }, { lat: 11.01681, lng: 76.95581 });
    expect(path).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
