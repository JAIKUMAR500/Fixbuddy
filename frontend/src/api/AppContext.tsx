import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
} from "./client";
import { View } from "../types";
import { roleHome } from "./roles";
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

  const goToActiveJob = useCallback((job: JobRequest) => {
    setActiveRequestIdState(job.id);
    setViewingRequestId(job.id);
    setView("active-job");
    window.scrollTo(0, 0);
  }, []);

  const navigate = useCallback((v: View) => {
    const job = currentJobRef.current;
    if (isFocusJob(job) && SHOPPING_VIEWS.includes(v)) {
      goToActiveJob(job);
      return;
    }
    setView(v);
    window.scrollTo(0, 0);
  }, [goToActiveJob]);

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
          setView("active-job");
          window.scrollTo(0, 0);
          return;
        }
        setView("request-status");
        window.scrollTo(0, 0);
        return;
      }
      if (isFocusJob(job) && SHOPPING_VIEWS.includes(dest)) {
        goToActiveJob(job);
        return;
      }
      setView(dest);
      window.scrollTo(0, 0);
    },
    [goToActiveJob]
  );

  const refreshCurrentJob = useCallback(async () => {
    if (!localStorage.getItem("fb_token")) {
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
      const { token, user: u } = await AuthAPI.login(String(email || "").trim(), password, role);
      localStorage.setItem("fb_token", token);
      routeAfterAuth(u);
      return u;
    },
    [routeAfterAuth]
  );

  const signup = useCallback(
    async (body: object) => {
      const { token, user: u } = await AuthAPI.signup(body);
      localStorage.setItem("fb_token", token);
      routeAfterAuth(u);
      return u;
    },
    [routeAfterAuth]
  );

  const googleLogin = useCallback(
    async (credential: string, role?: string) => {
      const { token, user: u } = await AuthAPI.google(credential, role);
      localStorage.setItem("fb_token", token);
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
    localStorage.removeItem("fb_token");
    currentJobRef.current = null;
    setUser(null);
    setActiveRequestIdState(null);
    setViewingRequestId(null);
    setCurrentJob(null);
    setSelectedProvider(null);
    setUnreadNotifications(0);
    setView("landing");
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      currentJobRef.current = null;
      setUser(null);
      setActiveRequestIdState(null);
      setViewingRequestId(null);
      setCurrentJob(null);
      setSelectedProvider(null);
      setUnreadNotifications(0);
      setView("login");
    };
    window.addEventListener("fixbuddy:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fixbuddy:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("fb_token");
    const qs = new URLSearchParams(window.location.search);
    const pro = qs.get("pro");
    const watch = qs.get("watch");
    if (!token) {
      if (watch) setView("family-watch");
      else if (pro) setView("public-passport");
      setReady(true);
      return;
    }
    AuthAPI.me()
      .then(async ({ user: u }) => {
        setUser(u);
        if (watch) {
          setView("family-watch");
          return;
        }
        if (pro) {
          setView("public-passport");
          return;
        }
        const needsOnboard =
          (u.role === "worker" || u.role === "business" || u.role === "provider") && !u.provider?.onboarded;
        if (needsOnboard) {
          setView("business-onboarding");
          return;
        }
        try {
          const { request } = await RequestAPI.currentJob();
          const focused = isFocusJob(request) ? request : null;
          setCurrentJob(focused);
          currentJobRef.current = focused;
          if (focused) {
            setActiveRequestIdState(focused.id);
            setView("active-job");
            return;
          }
          setActiveRequestIdState(null);
        } catch {
          /* keep home */
        }
        setView(roleHome(u));
        void refreshLocation(u, setUser);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status !== 401) {
          setUser(null);
          setView("login");
          return;
        }
        localStorage.removeItem("fb_token");
        setUser(null);
        setView(watch ? "family-watch" : pro ? "public-passport" : "login");
      })
      .finally(() => setReady(true));
  }, []);

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
    const timer = window.setInterval(() => void poll(), 8000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => void refreshCurrentJob(), 12000);
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
