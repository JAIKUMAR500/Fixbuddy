import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate as useRouterNavigate } from "react-router-dom";

vi.mock("./realtime", () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  isRealtimeConnected: () => false,
  joinRealtimeJob: vi.fn(),
  subscribeRealtime: () => () => {},
}));

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    AuthAPI: { ...actual.AuthAPI, me: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) },
    RequestAPI: { ...actual.RequestAPI, currentJob: vi.fn() },
    NotifAPI: {
      ...actual.NotifAPI,
      list: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }),
      preferences: vi.fn().mockResolvedValue({ preferences: { browser: false } }),
    },
  };
});

import { AppProvider, useApp } from "./AppContext";
import { AuthAPI, RequestAPI, type AppUser, type JobRequest } from "./client";

function Probe() {
  const { view, ready, viewingRequestId } = useApp();
  const { pathname } = useLocation();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="view">{view}</span>
      <span data-testid="path">{pathname}</span>
      <span data-testid="viewing">{viewingRequestId || ""}</span>
    </div>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <Probe />
      </AppProvider>
    </MemoryRouter>
  );
}

const worker = { id: "w1", role: "worker", name: "Worker", provider: { onboarded: true } } as unknown as AppUser;
const customer = { id: "c1", role: "customer", name: "Customer" } as unknown as AppUser;

const engagedJob = { id: "job1", status: "on_the_way", category: "Plumbing" } as unknown as JobRequest;

const readyState = async () => {
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: null } as never);
});

describe("deep links and refresh", () => {
  it("keeps the requested route for a signed-in worker instead of forcing the dashboard", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: worker } as never);

    renderAt("/worker/passport");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("worker-passport");
    expect(screen.getByTestId("path")).toHaveTextContent("/worker/passport");
  });

  it("restores a request detail route and its id", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: customer } as never);

    renderAt("/customer/requests/req42");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("request-status");
    expect(screen.getByTestId("viewing")).toHaveTextContent("req42");
  });

  it("rewrites the bare root to the role home", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: customer } as never);

    renderAt("/");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("customer-home");
    expect(screen.getByTestId("path")).toHaveTextContent("/customer/home");
  });
});

describe("unauthenticated access", () => {
  it("sends a private deep link to the login screen", async () => {
    renderAt("/customer/home");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("login");
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    expect(AuthAPI.me).not.toHaveBeenCalled();
  });

  it("leaves a public deep link alone", async () => {
    renderAt("/business");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("business-landing");
    expect(screen.getByTestId("path")).toHaveTextContent("/business");
  });
});

describe("active job focus lock", () => {
  it("redirects a shopping deep link to the active job", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: customer } as never);
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: engagedJob } as never);

    renderAt("/customer/create-request");
    await readyState();

    await waitFor(() => expect(screen.getByTestId("view")).toHaveTextContent("active-job"));
    expect(screen.getByTestId("path")).toHaveTextContent("/job/active");
  });

  it("still allows a non-shopping deep link while a job is engaged", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: customer } as never);
    vi.mocked(RequestAPI.currentJob).mockResolvedValue({ request: engagedJob } as never);

    renderAt("/customer/profile");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("customer-profile");
  });
});

describe("browser history", () => {
  function HistoryProbe() {
    const { navigate, view, ready } = useApp();
    const routerNavigate = useRouterNavigate();
    const { pathname } = useLocation();
    return (
      <div>
        <span data-testid="ready">{String(ready)}</span>
        <span data-testid="view">{view}</span>
        <span data-testid="path">{pathname}</span>
        <button type="button" onClick={() => navigate("my-requests")}>
          go-requests
        </button>
        <button type="button" onClick={() => navigate("customer-profile")}>
          go-profile
        </button>
        <button type="button" onClick={() => routerNavigate(-1)}>
          back
        </button>
        <button type="button" onClick={() => routerNavigate(1)}>
          forward
        </button>
      </div>
    );
  }

  it("keeps Back and Forward in step with the view", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({ user: customer } as never);

    render(
      <MemoryRouter initialEntries={["/customer/home"]}>
        <AppProvider>
          <HistoryProbe />
        </AppProvider>
      </MemoryRouter>
    );
    await readyState();
    expect(screen.getByTestId("view")).toHaveTextContent("customer-home");

    await userEvent.click(screen.getByText("go-requests"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/customer/requests"));
    expect(screen.getByTestId("view")).toHaveTextContent("my-requests");

    await userEvent.click(screen.getByText("go-profile"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/customer/profile"));

    await userEvent.click(screen.getByText("back"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/customer/requests"));
    expect(screen.getByTestId("view")).toHaveTextContent("my-requests");

    await userEvent.click(screen.getByText("back"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/customer/home"));
    expect(screen.getByTestId("view")).toHaveTextContent("customer-home");

    await userEvent.click(screen.getByText("forward"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/customer/requests"));
    expect(screen.getByTestId("view")).toHaveTextContent("my-requests");
  });
});

describe("worker onboarding gate", () => {
  it("forces onboarding before any other route", async () => {
    localStorage.setItem("fb_token", "t");
    vi.mocked(AuthAPI.me).mockResolvedValue({
      user: { ...worker, provider: { onboarded: false } } as unknown as AppUser,
    } as never);

    renderAt("/worker/target");
    await readyState();

    expect(screen.getByTestId("view")).toHaveTextContent("business-onboarding");
    expect(screen.getByTestId("path")).toHaveTextContent("/business/onboarding");
  });
});
