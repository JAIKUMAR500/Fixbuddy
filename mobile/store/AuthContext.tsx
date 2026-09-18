import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppUser, JobRequest } from "../types";
import { AuthAPI, persistSession } from "../services/api";
import { RequestAPI } from "../services/requests";
import { getOnboarded, getToken, setOnboarded, setToken } from "../services/session";

type AuthCtx = {
  ready: boolean;
  onboarded: boolean;
  signedIn: boolean;
  user: AppUser | null;
  currentJob: JobRequest | null;
  jobLocked: boolean;
  completeOnboarding: () => Promise<void>;
  login: (email: string, password: string, role?: string) => Promise<AppUser>;
  signup: (body: { name: string; email: string; password: string; role: string }) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshJob: () => Promise<JobRequest | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboard] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentJob, setCurrentJob] = useState<JobRequest | null>(null);
  const [jobLocked, setJobLocked] = useState(false);

  const refreshJob = useCallback(async () => {
    try {
      const data = await RequestAPI.currentJob();
      setCurrentJob(data.request);
      setJobLocked(!!data.locked);
      return data.request;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const cap = setTimeout(() => {
      if (alive) setReady(true);
    }, 2000);
    (async () => {
      try {
        setOnboard(await getOnboarded());
        const token = await getToken();
        if (!token) {
          if (alive) {
            setSignedIn(false);
            setUser(null);
          }
          return;
        }
        const { user: me } = await AuthAPI.me();
        if (!alive) return;
        setSignedIn(true);
        setUser(me);
        await refreshJob();
      } catch {
        await setToken("");
        if (alive) {
          setSignedIn(false);
          setUser(null);
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(cap);
    };
  }, [refreshJob]);

  const completeOnboarding = useCallback(async () => {
    await setOnboarded();
    setOnboard(true);
  }, []);

  const login = useCallback(async (email: string, password: string, role?: string) => {
    const { token, user: next } = await AuthAPI.login(email.trim(), password, role);
    await persistSession(token);
    setSignedIn(true);
    setUser(next);
    await refreshJob();
    return next;
  }, [refreshJob]);

  const signup = useCallback(async (body: { name: string; email: string; password: string; role: string }) => {
    const { token, user: next } = await AuthAPI.signup(body);
    await persistSession(token);
    setSignedIn(true);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      /* still clear locally */
    }
    await setToken("");
    setSignedIn(false);
    setUser(null);
    setCurrentJob(null);
    setJobLocked(false);
  }, []);

  const value = useMemo(
    () => ({ ready, onboarded, signedIn, user, currentJob, jobLocked, completeOnboarding, login, signup, logout, refreshJob }),
    [ready, onboarded, signedIn, user, currentJob, jobLocked, completeOnboarding, login, signup, logout, refreshJob],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
