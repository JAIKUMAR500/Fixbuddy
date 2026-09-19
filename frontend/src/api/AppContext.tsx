import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppNotif,
  AppUser,
  ApiError,
  AuthAPI,
  JobRequest,
  NotifAPI,
  Provider as ApiProvider,
  RequestAPI,
  api,
  persistSession,
  clearSession,
  hasSessionHint,
} from "./client";
import { connectRealtime, disconnectRealtime, isRealtimeConnected, joinRealtimeJob, subscribeRealtime } from "./realtime";
import { View } from "../types";
import { PUBLIC_VIEWS, canAccessView, roleHome } from "./roles";
import { matchRoute, pathForView } from "./routes";
import { readGps } from "./geo";
import { isEngagedStatus } from "./jobLock";

async function refreshLocation(current: AppUser, apply: (u: AppUser) => void) {
  if (current.lat != null && current.lng != null) return;
  try {
    const pos = await readGps();
    const { user: next } = await AuthAPI.updateMe({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
    apply(next);
  } catch {
    /* GPS is optional */
  }
}

type Ctx = {
  user: AppUser | null;
  ready: boolean;
  view: View;
  navigate: (v: View) => void;
  requestData: Partial<{ description: string; category: string; address: string; area: string; city: string; timing: string; photos: string[]; lat: number | null; lng: number | null; landmark: string }>;
  setRequestData: (d: Ctx["requestData"]) => void;
  selectedProvider: ApiProvider | null;
  setSelectedProvider: (p: ApiProvider | null) => void;
  viewingRequestId: string | null;
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;
  currentJob: JobRequest | null;
  jobFocusLocked: boolean;
  openRequest: (id: string, dest?: View) => void;
  refreshCurrentJob: () => Promise<JobRequest | null>;
  login: (email: string, password: string, role?: string) => Promise<AppUser>;
  signup: (body: object) => Promise<AppUser>;
  googleLogin: (credential: string, role?: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  setUser: (u: AppUser | null) => void;
  routeAfterAuth: (u: AppUser) => void;
  unreadNotifications: number;
};

const AppContext = createContext<Ctx | null>(null);

const SKIP_JOB_REDIRECT: View[] = [
  "public-passport",
  "family-watch",
  "business-onboarding",
  "worker-safety",
  "customer-support",
  "customer-profile",
  "business-profile",
  "worker-passport",
];

const SHOPPING_VIEWS: View[] = [
  "create-request",
  "finding-solutions",
  "matched-providers",
  "find-crew",
  "provider-details",
];

function isFocusJob(job: JobRequest | null | undefined): job is JobRequest {
  return Boolean(job && isEngagedStatus(job.status));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("landing");
  const [requestData, setRequestData] = useState<Ctx["requestData"]>({});
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null);
  const [activeRequestId, setActiveRequestIdState] = useState<string | null>(null);
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<JobRequest | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const currentJobRef = useRef<JobRequest | null>(null);
  currentJobRef.current = currentJob;

  const location = useLocation();
  const routerNavigate = useNavigate();
  const roleRef = useRef<string | null>(null);
  roleRef.current = user?.role ?? null;
  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const viewingRef = useRef<string | null>(viewingRequestId);
  viewingRef.current = viewingRequestId;
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const searchRef = useRef(location.search);
  searchRef.current = location.search;
  /** Path this provider pushed and is still waiting to observe. */
  const pendingPathRef = useRef<string | null>(null);
  const bootPathRef = useRef(location.pathname);

  /** Watch tokens and professional codes are carried by the URL, not by state. */
  const urlExtra = useCallback((next: View) => {
    const parts = pathRef.current.split("/").filter(Boolean);
    const qs = new URLSearchParams(searchRef.current);
    if (next === "family-watch") {
      return parts[0] === "watch" ? parts[1] || "" : qs.get("watch") || "";
    }
    if (next === "public-passport") {
      return ["passport", "pro", "workers"].includes(parts[0] || "") ? parts[1] || "" : qs.get("pro") || "";
    }
    return "";
  }, []);

  /** Keeps the address bar in step with the view state machine. */
  const syncUrl = useCallback(
    (next: View, requestId?: string | null) => {
      const target = pathForView(next, {
        requestId: requestId === undefined ? viewingRef.current : requestId,
        role: roleRef.current,
        code: urlExtra(next),
      });
      if (pathRef.current === target) {
        pendingPathRef.current = null;
        return;
      }
      pendingPathRef.current = target;
      routerNavigate(target);
    },
    [routerNavigate, urlExtra]
  );

  const applyView = useCallback(
    (next: View, requestId?: string | null) => {
      setView(next);
      syncUrl(next, requestId);
    },
    [syncUrl]
  );

  const goToActiveJob = useCallback(
    (job: JobRequest) => {
      setActiveRequestIdState(job.id);
      setViewingRequestId(job.id);
      applyView("active-job", job.id);
      window.scrollTo(0, 0);
    },
    [applyView]
  );

  const navigate = useCallback((v: View) => {
    const job = currentJobRef.current;
    if (isFocusJob(job) && SHOPPING_VIEWS.includes(v)) {
      goToActiveJob(job);
      return;
    }
    applyView(v);
    window.scrollTo(0, 0);
  }, [goToActiveJob, applyView]);

  const setActiveRequestId = useCallback((id: string | null) => {
    setActiveRequestIdState(id);
    if (id) setViewingRequestId(id);
  }, []);

  const openRequest = useCallback(
    (id: string, dest: View = "request-status") => {
      const job = currentJobRef.current;
      setViewingRequestId(id);
      setActiveRequestIdState(id);
      if (dest === "active-job") {
        if (isFocusJob(job) && job.id === id) {
          applyView("active-job", id);
          window.scrollTo(0, 0);
          return;
        }
        applyView("request-status", id);
        window.scrollTo(0, 0);
        return;
      }
      if (isFocusJob(job) && SHOPPING_VIEWS.includes(dest)) {
        goToActiveJob(job);
        return;
      }
      applyView(dest, id);
      window.scrollTo(0, 0);
    },
    [goToActiveJob, applyView]
  );

  const refreshCurrentJob = useCallback(async () => {
    if (!hasSessionHint()) {
      setCurrentJob(null);
      currentJobRef.current = null;
      setActiveRequestIdState(null);
      return null;
    }
    try {
      const { request } = await RequestAPI.currentJob();
      const focused = isFocusJob(request) ? request : null;
      setCurrentJob(focused);
      currentJobRef.current = focused;
      return focused;
    } catch {
      return null;
    }
  }, []);

  const goHomeOrJob = useCallback(
    async (u: AppUser, forceJob: boolean) => {
      const needsOnboard =
        (u.role === "worker" || u.role === "business" || u.role === "provider") && !u.provider?.onboarded;
      if (needsOnboard) {
        navigate("business-onboarding");
        return;
      }
      const job = await refreshCurrentJob();
      if (isFocusJob(job) && (forceJob || SKIP_JOB_REDIRECT.indexOf(view) < 0)) {
        goToActiveJob(job);
        return;
      }
      navigate(roleHome(u));
    },
    [navigate, refreshCurrentJob, view, goToActiveJob]
  );

  const routeAfterAuth = useCallback(
    (u: AppUser) => {
      setUser(u);
      void goHomeOrJob(u, true);
      void refreshLocation(u, setUser);
    },
    [goHomeOrJob]
  );

  const login = useCallback(
    async (email: string, password: string, role?: string) => {
      const { token, refreshToken, user: u } = await AuthAPI.login(String(email || "").trim(), password, role);
      persistSession(token, refreshToken);
      routeAfterAuth(u);
      return u;
    },
    [routeAfterAuth]
  );

  const signup = useCallback(
    async (body: object) => {
      const { token, refreshToken, user: u } = await AuthAPI.signup(body);
      persistSession(token, refreshToken);
      routeAfterAuth(u);
      return u;
    },
    [routeAfterAuth]
  );

  const googleLogin = useCallback(
    async (credential: string, role?: string) => {
      const { token, refreshToken, user: u } = await AuthAPI.google(credential, role);
      persistSession(token, refreshToken);
      routeAfterAuth(u);
      return u;
    },
    [routeAfterAuth]
  );

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      /* The local session must still be removed when the network is unavailable. */
    }
    clearSession();
    disconnectRealtime();
    currentJobRef.current = null;
    setUser(null);
    setActiveRequestIdState(null);
    setViewingRequestId(null);
    setCurrentJob(null);
    setSelectedProvider(null);
    setUnreadNotifications(0);
    applyView("landing", null);
    window.scrollTo(0, 0);
  }, [applyView]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      disconnectRealtime();
      currentJobRef.current = null;
      setUser(null);
      setActiveRequestIdState(null);
      setViewingRequestId(null);
      setCurrentJob(null);
      setSelectedProvider(null);
      setUnreadNotifications(0);
      applyView("login", null);
    };
    window.addEventListener("fixbuddy:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fixbuddy:unauthorized", onUnauthorized);
  }, [applyView]);

  useEffect(() => {
    const token = localStorage.getItem("fb_token");
    const sessionHint = hasSessionHint();
    const qs = new URLSearchParams(window.location.search);
    const pro = qs.get("pro");
    const watch = qs.get("watch");
    const bootPath = bootPathRef.current;

    /** A deep link is any app route other than the bare landing page. */
    const deepLinkFor = (role: string | null) => {
      const routed = matchRoute(bootPath, role);
      return routed && routed.view !== "landing" ? routed : null;
    };

    if (!token && !sessionHint) {
      const routed = deepLinkFor(null);
      if (watch || routed?.view === "family-watch") setView("family-watch");
      else if (pro || routed?.view === "public-passport") setView("public-passport");
      else if (routed && PUBLIC_VIEWS.includes(routed.view)) setView(routed.view);
      else if (routed) applyView("login", null);
      else if (bootPath !== "/") applyView("landing", null);
      setReady(true);
      return;
    }

    AuthAPI.me()
      .then(async ({ user: u }) => {
        setUser(u);
        roleRef.current = u.role;
        if (watch) {
          setView("family-watch");
          return;
        }
        if (pro) {
          setView("public-passport");
          return;
        }
        const routed = deepLinkFor(u.role);
        if (routed?.view === "family-watch" || routed?.view === "public-passport") {
          setView(routed.view);
          return;
        }
        const allowed = routed && canAccessView(u, routed.view) ? routed : null;
        const needsOnboard =
          (u.role === "worker" || u.role === "business" || u.role === "provider") && !u.provider?.onboarded;
        if (needsOnboard) {
          applyView("business-onboarding", null);
          return;
        }
        try {
          const { request } = await RequestAPI.currentJob();
          const focused = isFocusJob(request) ? request : null;
          setCurrentJob(focused);
          currentJobRef.current = focused;
          if (focused) {
            setActiveRequestIdState(focused.id);
            // The job lock still wins over any shopping deep link.
            if (!allowed || SHOPPING_VIEWS.includes(allowed.view)) {
              setViewingRequestId(focused.id);
              applyView("active-job", focused.id);
              return;
            }
          } else {
            setActiveRequestIdState(null);
          }
        } catch {
          /* keep the resolved route below */
        }
        if (allowed) {
          if (allowed.requestId) {
            setViewingRequestId(allowed.requestId);
            setActiveRequestIdState(allowed.requestId);
          }
          setView(allowed.view);
        } else {
          applyView(roleHome(u), null);
        }
        void refreshLocation(u, setUser);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status !== 401) {
          setUser(null);
          applyView("login", null);
          return;
        }
        clearSession();
        setUser(null);
        if (watch) setView("family-watch");
        else if (pro) setView("public-passport");
        else applyView("login", null);
      })
      .finally(() => setReady(true));
    // Boot runs once; applyView is stable for the lifetime of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** URL is the entry point for refresh, deep links, and Back/Forward. */
  useEffect(() => {
    if (!ready) return;
    if (pendingPathRef.current) {
      // A redirect of ours is still in flight; do not resolve the stale path.
      if (location.pathname !== pendingPathRef.current) return;
      pendingPathRef.current = null;
    }
    const routed = matchRoute(location.pathname, roleRef.current);
    if (!routed) return;
    if (routed.requestId && routed.requestId !== viewingRef.current) {
      setViewingRequestId(routed.requestId);
      setActiveRequestIdState(routed.requestId);
    }
    if (routed.view !== viewRef.current) setView(routed.view);
  }, [location.pathname, ready]);

  useEffect(() => {
    if (!user) return;
    let initialized = false;
    let seen = new Set<string>();
    let browserEnabled = true;
    const announce = (notification: AppNotif) => {
      window.dispatchEvent(new CustomEvent("fixbuddy:notification", { detail: notification }));
      if (!browserEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const audio = new AudioContextClass();
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, audio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start();
          oscillator.stop(audio.currentTime + 0.2);
          window.setTimeout(() => void audio.close(), 300);
        }
      } catch {
        /* Browsers may block audio until the user interacts. */
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("FixBuddy update", { body: notification.text });
      }
    };
    const poll = async () => {
      try {
        const preferenceResult = await NotifAPI.preferences();
        browserEnabled = preferenceResult.preferences.browser !== false;
        const result = await NotifAPI.list();
        setUnreadNotifications(result.unread);
        const current = new Set<string>(result.notifications.map((item) => item.id));
        if (initialized) {
          result.notifications.filter((item) => !seen.has(item.id) && !item.read).slice(0, 3).forEach(announce);
        }
        seen = current;
        initialized = true;
      } catch {
        /* Notification polling is best effort. */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), isRealtimeConnected() ? 30_000 : 8000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      disconnectRealtime();
      return;
    }
    connectRealtime(localStorage.getItem("fb_token") || undefined);
    const offStatus = subscribeRealtime("job:status_change", () => {
      void refreshCurrentJob();
    });
    return () => {
      offStatus();
    };
  }, [user?.id, refreshCurrentJob]);

  useEffect(() => {
    joinRealtimeJob(currentJob?.id);
  }, [currentJob?.id]);

  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => void refreshCurrentJob(), isRealtimeConnected() ? 30_000 : 12_000);
    return () => window.clearInterval(t);
  }, [user, refreshCurrentJob]);

  useEffect(() => {
    if (!isFocusJob(currentJob)) return;
    if (SHOPPING_VIEWS.includes(view)) goToActiveJob(currentJob);
  }, [currentJob, view, goToActiveJob]);

  const jobFocusLocked = isFocusJob(currentJob);

  const value = useMemo(
    () => ({
      user,
      ready,
      view,
      navigate,
      requestData,
      setRequestData,
      selectedProvider,
      setSelectedProvider,
      activeRequestId,
      viewingRequestId,
      setActiveRequestId,
      currentJob,
      jobFocusLocked,
      openRequest,
      refreshCurrentJob,
      login,
      signup,
      googleLogin,
      logout,
      setUser,
      routeAfterAuth,
      unreadNotifications,
    }),
    [
      user,
      ready,
      view,
      navigate,
      requestData,
      selectedProvider,
      activeRequestId,
      viewingRequestId,
      currentJob,
      jobFocusLocked,
      openRequest,
      refreshCurrentJob,
      login,
      signup,
      googleLogin,
      logout,
      routeAfterAuth,
      unreadNotifications,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useFetch<T>(path: string | null, refreshKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api<T>(path)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e: Error) => {
        const network = /failed to fetch|networkerror|load failed|offline/i.test(e.message || "");
        if (e instanceof ApiError && e.status === 401) setError("Session expired. Please sign in again.");
        else if (e instanceof ApiError && e.status === 403) setError("You don't have permission to view this.");
        else if (network) setError("Unable to load data. Check your connection and try again.");
        else setError(e.message || "Unable to load data");
      })
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { data, loading, error, reload, setData };
}

export type { JobRequest };
