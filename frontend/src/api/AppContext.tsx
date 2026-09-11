import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppUser, AuthAPI, JobRequest, Provider as ApiProvider, RequestAPI, api } from "./client";
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
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;
  currentJob: JobRequest | null;
  refreshCurrentJob: () => Promise<JobRequest | null>;
  login: (email: string, password: string, role?: string) => Promise<AppUser>;
  signup: (body: object) => Promise<AppUser>;
  googleLogin: (credential: string, role?: string) => Promise<AppUser>;
  logout: () => void;
  setUser: (u: AppUser | null) => void;
  routeAfterAuth: (u: AppUser) => void;
};

const AppContext = createContext<Ctx | null>(null);

const SKIP_JOB_REDIRECT: View[] = ["public-passport", "family-watch", "business-onboarding", "worker-safety", "customer-support", "customer-profile", "business-profile", "worker-passport"];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("landing");
  const [requestData, setRequestData] = useState<Ctx["requestData"]>({});
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<JobRequest | null>(null);

  const navigate = useCallback((v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  const refreshCurrentJob = useCallback(async () => {
    if (!localStorage.getItem("fb_token")) {
      setCurrentJob(null);
      return null;
    }
    try {
      const { request } = await RequestAPI.currentJob();
      setCurrentJob(request);
      if (request && isEngagedStatus(request.status)) setActiveRequestId(request.id);
      return request;
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
      if (job && isEngagedStatus(job.status) && (forceJob || SKIP_JOB_REDIRECT.indexOf(view) < 0)) {
        setActiveRequestId(job.id);
        navigate("active-job");
        return;
      }
      navigate(roleHome(u));
    },
    [navigate, refreshCurrentJob, view]
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

  const logout = useCallback(() => {
    localStorage.removeItem("fb_token");
    setUser(null);
    setActiveRequestId(null);
    setCurrentJob(null);
    setSelectedProvider(null);
    navigate("landing");
  }, [navigate]);

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
          setCurrentJob(request);
          if (request && isEngagedStatus(request.status)) {
            setActiveRequestId(request.id);
            setView("active-job");
            return;
          }
        } catch {
          /* keep home */
        }
        setView(roleHome(u));
        void refreshLocation(u, setUser);
      })
      .catch(() => {
        localStorage.removeItem("fb_token");
        setUser(null);
        setView(watch ? "family-watch" : pro ? "public-passport" : "login");
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => void refreshCurrentJob(), 12000);
    return () => window.clearInterval(t);
  }, [user, refreshCurrentJob]);

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
      setActiveRequestId,
      currentJob,
      refreshCurrentJob,
      login,
      signup,
      googleLogin,
      logout,
      setUser,
      routeAfterAuth,
    }),
    [user, ready, view, navigate, requestData, selectedProvider, activeRequestId, currentJob, refreshCurrentJob, login, signup, googleLogin, logout, routeAfterAuth]
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
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { data, loading, error, reload, setData };
}

export type { JobRequest };
