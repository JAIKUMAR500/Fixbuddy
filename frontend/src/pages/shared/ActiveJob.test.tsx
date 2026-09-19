import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppUser, JobRequest } from "../../api/client";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
let role: AppUser["role"] = "worker";

vi.mock("../../api/AppContext", () => ({
  useApp: () => ({
    user: { id: role === "worker" ? "w1" : "c1", role, name: "User" } as AppUser,
    setActiveRequestId: vi.fn(),
    refreshCurrentJob: vi.fn(),
  }),
}));

vi.mock("../../api/realtime", () => ({
  subscribeRealtime: () => () => { },
  subscribeConnection: (cb: (state: string) => void) => {
    cb("disconnected");
    return () => { };
  },
  getRealtimeConnectionState: () => "disconnected",
  publishWorkerLocation: () => false,
  isRealtimeConnected: () => false,
  joinRealtimeJob: () => { },
}));

vi.mock("../../api/useWorkerGps", () => ({
  useWorkerGps: () => "idle",
}));

vi.mock("../../i18n/LangContext", () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    RequestAPI: {
      ...actual.RequestAPI,
      currentJob: vi.fn(),
      verifyOtp,
      collectPayment: vi.fn(),
      customerComplete: vi.fn(),
    },
    ChatAPI: { ...actual.ChatAPI, open: vi.fn() },
    uploadImage: vi.fn(),
  };
});

import ActiveJob from "./ActiveJob";
import { RequestAPI } from "../../api/client";

function job(status: string, extras: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job1",
    code: "REQ-0001",
    category: "Plumbing",
    description: "Kitchen tap",
    status,
    paymentStatus: "",
    address: "12 Test Street",
    area: "Peelamedu",
    city: "Coimbatore",
    ...extras,
  } as JobRequest;
}

describe("ActiveJob OTP and payment states", () => {
  beforeEach(() => {
    role = "worker";
    verifyOtp.mockReset();
    vi.mocked(RequestAPI.currentJob).mockReset();
    vi.mocked(RequestAPI.collectPayment).mockReset();
    vi.mocked(RequestAPI.customerComplete).mockReset();
  });

  it("asks the worker for the customer OTP after arrival", async () => {
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: job("arrived") } as never);
    render(<ActiveJob navigate={() => { }} />);
    expect(await screen.findByPlaceholderText(/4-digit otp/i)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/4-digit otp/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /verify otp/i }));
    expect(verifyOtp).toHaveBeenCalledWith("job1", "1234");
  });

  it("shows the customer OTP when the job has arrived", async () => {
    role = "customer";
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({
      request: job("arrived", { jobOtp: "4821" }),
    } as never);
    render(<ActiveJob navigate={() => { }} />);
    expect(await screen.findByText("4821")).toBeInTheDocument();
    expect(screen.getAllByText(/worker has arrived/i).length).toBeGreaterThan(0);
  });

  it("shows live tracking for the customer after the worker accepts", async () => {
    role = "customer";
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({
      request: job("on_the_way", {
        lat: 11.0168,
        lng: 76.9558,
        workerLat: 11.02,
        workerLng: 76.96,
        workerLocationAt: new Date().toISOString(),
        etaMinutes: 8,
        distanceKm: 1.2,
        provider: { name: "Ravi", rating: 4.9, avatar: "", verified: true, phone: "999" } as JobRequest["provider"],
      }),
    } as never);
    render(<ActiveJob navigate={() => { }} />);
    expect(await screen.findByText(/track your worker/i)).toBeInTheDocument();
    expect(screen.getByTestId("live-track-map")).toBeInTheDocument();
    expect(screen.getByText(/worker is on the way/i)).toBeInTheDocument();
    expect(screen.getAllByText(/8 min/).length).toBeGreaterThan(0);
  });

  it("shows collect amount and Find next job after worker collects payment", async () => {
    const completed = job("completed", {
      estimatedAmount: 800,
      finance: {
        settled: true,
        jobPriceRupees: 800,
        commissionRupees: 80,
        workerNetRupees: 720,
        commissionPercent: 10,
      } as JobRequest["finance"],
    });
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: completed } as never);
    vi.mocked(RequestAPI.collectPayment).mockImplementation(async () => {
      vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: null } as never);
      return { request: job("payment_collected") } as never;
    });

    const navigate = vi.fn();
    render(<ActiveJob navigate={navigate} />);
    expect(await screen.findByRole("button", { name: /Collect ₹800/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Collect ₹800/i }));
    expect(await screen.findByTestId("payment-success")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find next job/i })).toBeInTheDocument();
  });

  it("shows the agreed amount when the customer confirms completion", async () => {
    role = "customer";
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({
      request: job("completed", { estimatedAmount: 1200 }),
    } as never);
    render(<ActiveJob navigate={() => {}} />);
    expect(await screen.findByText(/Confirm amount/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Completion · ₹1,200/i })).toBeInTheDocument();
  });
});
