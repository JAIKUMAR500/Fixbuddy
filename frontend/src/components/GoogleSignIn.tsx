import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

type GoogleId = {
  initialize: (opts: Record<string, unknown>) => void;
  prompt: (cb?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; getNotDisplayedReason?: () => string }) => void) => void;
  renderButton: (el: HTMLElement, opts: object) => void;
  cancel: () => void;
};

function gsi(): GoogleId | undefined {
  return (window as unknown as { google?: { accounts: { id: GoogleId } } }).google?.accounts?.id;
}

export default function GoogleSignIn({
  onCredential,
  label = "Continue with Google",
}: {
  onCredential: (credential: string) => void;
  label?: string;
}) {
  const [clientId, setClientId] = useState(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    api<{ googleClientId?: string }>("/public/config")
    .then((d) => setClientId(String(d.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim()))
      .catch(() => setClientId(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim()))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const boot = () => {
      if (cancelled) return;
      const google = gsi();
      const host = hostRef.current;
      if (!google || !host) return;
      host.innerHTML = "";
      google.initialize({
        client_id: clientId,
        callback: (resp: { credential?: string }) => {
          if (resp?.credential) cbRef.current(resp.credential);
          else setError("Google did not return a sign-in token. Try again.");
        },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        context: "signin",
      });
      const paint = () => {
        if (cancelled || !hostRef.current) return;
        const width = Math.max(240, Math.min(400, Math.floor(hostRef.current.clientWidth || 336)));
        google.renderButton(hostRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: label.toLowerCase().includes("sign up") ? "signup_with" : "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });
      };
      requestAnimationFrame(paint);
    };

    const existing = document.getElementById("google-gsi") as HTMLScriptElement | null;
    if (existing) {
      if (gsi()) boot();
      else existing.addEventListener("load", boot);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", boot);
      };
    }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = boot;
    script.onerror = () => setError("Could not load Google. Check your network.");
    document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [clientId, label]);

  return (
    <div>
      {loading ? (
        <div className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
      ) : !clientId ? (
        <p className="text-xs text-amber-700 text-center bg-amber-50 rounded-xl px-3 py-2">
          Add a Google Web Client ID in Super Admin → Settings (and Authorized JavaScript origins in Google Cloud).
        </p>
      ) : (
        <div ref={hostRef} className="w-full min-h-12 flex justify-center overflow-x-auto [&>div]:max-w-full" />
      )}
      {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
