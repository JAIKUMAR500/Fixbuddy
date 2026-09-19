import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LiveTrackMap from "./LiveTrackMap";
import JobTrackingPanel from "./JobTrackingPanel";
import type { JobRequest } from "../api/client";

vi.mock("../api/phone", () => ({ startCall: vi.fn() }));

describe("LiveTrackMap", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          routes: [{ geometry: { coordinates: [[76.96, 11.02], [76.958, 11.018], [76.9558, 11.0168]] } }],
        }),
      }))
    );
  });

  it("shows both markers and is not a blank map", async () => {
    render(
      <LiveTrackMap
        customer={{ lat: 11.0168, lng: 76.9558 }}
        worker={{ lat: 11.02, lng: 76.96 }}
      />
    );
    expect(screen.getByTestId("live-track-map")).toBeInTheDocument();
    expect(screen.getByTestId("map-tiles")).toBeInTheDocument();
    expect(screen.getByTestId("map-tiles").querySelector("img")?.getAttribute("src")).toMatch(
      /openstreetmap|cartocdn/
    );
    expect(screen.getByTestId("marker-worker")).toBeInTheDocument();
    expect(screen.getByTestId("marker-customer")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("track-route")).toBeInTheDocument());
  });

  it("shows a waiting state until the first worker location arrives", () => {
    render(<LiveTrackMap customer={{ lat: 11.0168, lng: 76.9558 }} waitingForWorker />);
    expect(screen.getByText(/waiting for the worker/i)).toBeInTheDocument();
  });

  it("shows a stale-location message without crashing", () => {
    render(
      <LiveTrackMap
        customer={{ lat: 11.0168, lng: 76.9558 }}
        worker={{ lat: 11.02, lng: 76.96 }}
        stale
      />
    );
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
  });

  it("shows only the customer house for the worker", () => {
    render(
      <LiveTrackMap
        customer={{ lat: 11.0168, lng: 76.9558 }}
        worker={{ lat: 11.02, lng: 76.96 }}
        workerRole
      />
    );
    expect(screen.getByTestId("marker-customer")).toBeInTheDocument();
    expect(screen.queryByTestId("marker-worker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("track-route")).not.toBeInTheDocument();
    expect(screen.getByText(/customer house/i)).toBeInTheDocument();
  });
});

describe("JobTrackingPanel", () => {
  const job = {
    id: "job1",
    code: "REQ-1",
    category: "Plumbing",
    description: "Leak",
    status: "on_the_way",
    address: "12 Test Street",
    area: "Peelamedu",
    city: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    workerLat: 11.02,
    workerLng: 76.96,
    workerLocationAt: new Date().toISOString(),
    etaMinutes: 12,
    distanceKm: 2.4,
    provider: { name: "Ravi", rating: 4.8, avatar: "", verified: true, phone: "999" },
    customer: { id: "c1", name: "John", phone: "888" },
  } as unknown as JobRequest;

  it("shows the customer tracking card with ETA, distance, and call", () => {
    render(<JobTrackingPanel job={job} workerRole={false} socketState="connected" />);
    expect(screen.getByText(/worker is on the way/i)).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    expect(screen.getByText(/2.4 km/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /call worker/i })).toBeInTheDocument();
    expect(screen.getByTestId("live-watch-status")).toHaveTextContent(/watching live in fixbuddy/i);
    expect(screen.queryByText(/open live route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/track worker/i)).not.toBeInTheDocument();
  });

  it("hides the live map until a worker has accepted", () => {
    render(
      <JobTrackingPanel
        job={{ ...job, status: "matching", workerLat: null, workerLng: null }}
        workerRole={false}
        socketState="connected"
      />
    );
    expect(screen.queryByTestId("live-track-map")).not.toBeInTheDocument();
  });

  it("shows a GPS permission prompt for the worker without crashing", () => {
    render(<JobTrackingPanel job={job} workerRole gpsState="denied" socketState="connected" />);
    expect(screen.getByRole("button", { name: /enable location/i })).toBeInTheDocument();
  });
});
