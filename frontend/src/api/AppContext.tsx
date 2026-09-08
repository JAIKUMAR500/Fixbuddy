import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppUser, AuthAPI, JobRequest, Provider as ApiProvider, api } from "./client";
import { View } from "../types";
import { roleHome } from "./roles";
import { capturePlace } from "./geo";

async function refreshLocation(current: AppUser, apply: (u: AppUser) => void) {
  if (current.lat != null && current.lng != null) return;
  try {
    const place = await capturePlace();
    const { user: next } = await AuthAPI.updateMe({
      lat: place.lat,
      lng: place.lng,
      city: place.city || current.city,
      area: place.area || current.area,
      address: place.address || current.address,
    });
    apply(next);
  } catch {
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
  login: (email: string, password: string) => Promise<AppUser>;
  signup: (body: object) => Promise<AppUser>;
  googleLogin: (credential: string, role?: string) => Promise<AppUser>;
  logout: () => void;
  setUser: (u: AppUser | null) => void;
  routeAfterAuth: (u: AppUser) => void;
};

const AppContext = createContext<Ctx | null>(null);


export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("landing");
  const [requestData, setRequestData] = useState<Ctx["requestData"]>({});
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const navigate = useCallback((v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  const routeAfterAuth = useCallback(
    (u: AppUser) => {
      setUser(u);
      navigate(roleHome(u));
      void refreshLocation(u, setUser);
    },
    [navigate]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await AuthAPI.login(email, password);
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
    setSelectedProvider(null);
    navigate("landing");
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("fb_token");
    if (!token) {
      setReady(true);
      return;
    }
    AuthAPI.me()
      .then(({ user: u }) => {
        setUser(u);
        setView(roleHome(u));
      })
      .catch(() => localStorage.removeItem("fb_token"))
      .finally(() => setReady(true));
  }, []);

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
      login,
      signup,
      googleLogin,
      logout,
      setUser,
      routeAfterAuth,
    }),
    [user, ready, view, navigate, requestData, selectedProvider, activeRequestId, login, signup, googleLogin, logout, routeAfterAuth]
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
