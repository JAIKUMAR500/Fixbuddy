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
  });

  it("asks the worker for the customer OTP after arrival", async () => {
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: job("arrived") } as never);
    render(<ActiveJob navigate={() => {}} />);
    expect(await screen.findByPlaceholderText(/4-digit otp/i)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/4-digit otp/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /job.enterOtp/i }));
    expect(verifyOtp).toHaveBeenCalledWith("job1", "1234");
  });

  it("shows the customer OTP when the job has arrived", async () => {
    role = "customer";
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({
      request: job("arrived", { jobOtp: "4821" }),
    } as never);
    render(<ActiveJob navigate={() => {}} />);
    expect(await screen.findByText("4821")).toBeInTheDocument();
    expect(screen.getByText(/share this otp/i)).toBeInTheDocument();
  });
});
