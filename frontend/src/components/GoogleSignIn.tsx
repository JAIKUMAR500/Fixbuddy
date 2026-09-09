import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type GoogleId = {
  initialize: (opts: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
  prompt: (cb?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
  renderButton: (el: HTMLElement, opts: object) => void;
};

export default function GoogleSignIn({
  onCredential,
  label = "Continue with Google",
}: {
  onCredential: (credential: string) => void;
  label?: string;
}) {
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const gisRef = useRef<GoogleId | null>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    api<{ googleClientId?: string }>("/public/config")
      .then((d) => setClientId(String(d.googleClientId || "").trim()))
      .catch(() => setClientId(""))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const boot = () => {
      const google = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google;
      if (!google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential: string }) => cbRef.current(resp.credential),
      });
      gisRef.current = google.accounts.id;
    };
    const existing = document.getElementById("google-gsi");
    if (existing) {
      boot();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = boot;
    script.onerror = () => setError("Could not load Google");
    document.head.appendChild(script);
  }, [clientId]);

  const clickGoogle = () => {
    setError("");
    if (!clientId) {
      setError("Add Google Client ID in Super Admin → Settings, then try again.");
      return;
    }
    if (gisRef.current) {
      gisRef.current.prompt((n) => {
        if (n?.isNotDisplayed?.() || n?.isSkippedMoment?.()) {
          setError("Pick a Google account in the popup. If none appears, allow popups for this site.");
        }
      });
      return;
    }
    setError("Google is still loading. Wait a second and try again.");
  };

  return (
    <div>
      <button
        type="button"
        onClick={clickGoogle}
        disabled={loading}
        className="w-full h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm inline-flex items-center justify-center gap-3 shadow-sm"
      >
        <GoogleMark />
        {label}
      </button>
      {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
