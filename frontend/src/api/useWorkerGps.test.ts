import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkerGps } from "./useWorkerGps";

const pingLocation = vi.fn().mockResolvedValue({});
vi.mock("./client", () => ({
  RequestAPI: { pingLocation: (...args: unknown[]) => pingLocation(...args) },
}));
vi.mock("./realtime", () => ({
  isRealtimeConnected: () => false,
  publishWorkerLocation: () => false,
}));

describe("useWorkerGps", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("records permission denial without throwing", async () => {
    const watchPosition = vi.fn((_ok: unknown, err: (error: GeolocationPositionError) => void) => {
      err({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      return 1;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });
    const { result } = renderHook(() => useWorkerGps("job1", "on_the_way", true));
    await waitFor(() => expect(result.current).toBe("denied"));
    expect(pingLocation).not.toHaveBeenCalled();
  });
});
