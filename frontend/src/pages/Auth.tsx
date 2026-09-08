import React, { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Clock, BadgeCheck } from "lucide-react";
import { View } from "../types";
import { Button, Input } from "../components/ui";
import { useApp } from "../api/AppContext";
import { AuthAPI } from "../api/client";
import RoleGlyph from "../components/RoleGlyph";
import GoogleSignIn from "../components/GoogleSignIn";
import SupportContact from "../components/SupportContact";

type PublicRole = "customer" | "worker" | "business";
type Screen = "form" | "forgot-email" | "forgot-otp" | "forgot-password";

const ROLES: { id: PublicRole; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "business", label: "Business" },
  { id: "worker", label: "Worker" },
];

export default function Auth({ mode, navigate }: { mode: "login" | "signup"; navigate: (v: View) => void }) {
  const { login, signup, googleLogin, routeAfterAuth } = useApp();
  const [showPass, setShowPass] = useState(false);
  const [screen, setScreen] = useState<Screen>("form");
  const [selectedType, setSelectedType] = useState<PublicRole>(() => {
    try {
      const saved = sessionStorage.getItem("fb_signup_role");
      if (saved === "business" || saved === "worker" || saved === "customer") return saved;
    } catch {
      /* ignore */
    }
    return "customer";
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [otp, setOtp] = useState("");
  const [shownOtp, setShownOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    try {
      if (mode === "login" && sessionStorage.getItem("fb_forgot") === "1") {
        const mail = sessionStorage.getItem("fb_forgot_email") || "";
        sessionStorage.removeItem("fb_forgot");
        sessionStorage.removeItem("fb_forgot_email");
        if (mail) setForm((f) => ({ ...f, email: mail }));
        setScreen("forgot-email");
      }
    } catch {
      /* ignore */
    }
  }, [mode]);

  const sendOtp = async () => {
    setError("");
    setInfo("");
    setShownOtp("");
    setSubmitting(true);
    try {
      const d = await AuthAPI.forgot(form.email);
      setInfo(d.message);
      if (d.otp) {
        setShownOtp(d.otp);
        setOtp(d.otp);
      }
      setScreen("forgot-otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const savePassword = async () => {
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { token, user } = await AuthAPI.reset({ email: form.email, otp, password: form.password });
      localStorage.setItem("fb_token", token);
      routeAfterAuth(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const google = async (credential: string) => {
    setError("");
    setSubmitting(true);
    try {
      await googleLogin(credential, mode === "signup" ? selectedType : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup({ name: form.name, email: form.email, password: form.password, role: selectedType });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to complete authentication");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-brand p-10 text-white">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-white text-brand font-black flex items-center justify-center">F</span>
          <span className="text-xl font-bold font-display">FixBuddy</span>
        </div>
        <div>
          <h2 className="text-4xl font-black leading-tight font-display mb-4">
            Your problem.<br />Our priority.
          </h2>
          <p className="text-blue-100 max-w-md">
            Find trusted professionals for home, business and everyday service needs.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: BadgeCheck, text: "Verified professionals" },
              { icon: ShieldCheck, text: "Safe & secure" },
              { icon: Clock, text: "24/7 support" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-blue-50">
                <Icon className="w-5 h-5" /> {text}
              </div>
            ))}
          </div>
        </div>
        <SupportContact className="text-xs text-blue-200 hover:text-white" />
      </div>

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="max-w-md w-full mx-auto">
          <button onClick={() => (screen === "form" ? navigate("landing") : setScreen("form"))} className="text-sm text-slate-500 mb-6 hover:text-brand">← Back</button>
          <h1 className="text-3xl font-bold text-slate-900 font-display mb-2">
            {screen === "form"
              ? mode === "login" ? "Welcome back!" : "Create your account"
              : "Reset password"}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {screen === "forgot-email" && "Enter the email on your account. We will send a 6-digit OTP."}
            {screen === "forgot-otp" && `Enter the OTP sent to ${form.email}.`}
            {screen === "forgot-password" && "Choose a new password, then you can sign in."}
            {screen === "form" && (mode === "signup"
              ? "Name, email and password are enough. Extra details can wait."
              : "Sign in with your email, mobile number, or Google.")}
          </p>

          {mode === "signup" && screen === "form" && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {ROLES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`py-3 px-1 rounded-2xl text-sm font-semibold border transition-all ${selectedType === type.id ? "bg-brand text-white border-brand shadow-md" : "bg-canvas text-slate-600 border-transparent"}`}
                >
                  <RoleGlyph
                    role={type.id}
                    className="w-7 h-7"
                    boxClassName={`w-12 h-12 mx-auto mb-1 ${selectedType === type.id ? "bg-white text-brand" : ""}`}
                  />
                  {type.label}
                </button>
              ))}
            </div>
          )}

          {screen === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Input
                  label={selectedType === "business" ? "Business Name" : "Full Name"}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
              <Input
                label="Email or Mobile Number"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <div className="relative">
                <Input label="Password" type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "login" && (
                <div className="flex justify-between text-sm text-slate-500">
                  <label className="flex items-center gap-2"><input type="checkbox" /> Remember me</label>
                  <button type="button" className="text-brand" onClick={() => { setScreen("forgot-email"); setError(""); setInfo(""); }}>
                    Forgot password?
                  </button>
                </div>
              )}
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button type="submit" variant="primary" fullWidth size="lg" loading={submitting}>
                {mode === "login" ? "Login" : "Create Account"}
              </Button>
            </form>
          )}

          {screen === "forgot-email" && (
            <div className="space-y-4">
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
              <Button fullWidth size="lg" loading={submitting} onClick={() => void sendOtp()}>Send OTP</Button>
            </div>
          )}

          {screen === "forgot-otp" && (
            <div className="space-y-4">
              {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
              {shownOtp && (
                <div className="rounded-2xl border border-brand/20 bg-brand-soft p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-brand font-semibold">Your OTP</p>
                  <p className="text-3xl font-black font-display tracking-[0.35em] text-navy mt-1">{shownOtp}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {shownOtp
                      ? "Mail is queued. Cron sends it when Gmail SMTP is saved. Use this code now."
                      : "Check your Gmail inbox (and spam) for the 6-digit code."}
                  </p>
                </div>
              )}
              <Input label="6-digit OTP" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button fullWidth size="lg" disabled={otp.length !== 6} onClick={() => { setForm((f) => ({ ...f, password: "", confirm: "" })); setScreen("forgot-password"); }}>
                Verify OTP
              </Button>
              <button type="button" className="w-full text-sm text-brand" onClick={() => void sendOtp()}>Resend OTP</button>
            </div>
          )}

          {screen === "forgot-password" && (
            <div className="space-y-4">
              <div className="relative">
                <Input label="New password" type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Confirm new password" type={showPass ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button fullWidth size="lg" loading={submitting} onClick={() => void savePassword()}>Save password and login</Button>
            </div>
          )}

          {screen === "form" && (
            <>
              <div className="relative my-5 text-center text-xs text-slate-400">
                <span className="bg-white px-2 relative z-10">or</span>
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
              </div>
              <GoogleSignIn
                label={mode === "signup" ? "Sign up with Google" : "Continue with Google"}
                onCredential={(c) => void google(c)}
              />
              <p className="text-center text-sm text-slate-500 mt-6">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => navigate(mode === "login" ? "signup" : "login")} className="text-brand font-semibold">
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
              <p className="text-center text-xs text-slate-400 mt-3">
                Super Admin? <button onClick={() => navigate("admin-login")} className="text-brand font-semibold">Admin login</button>
              </p>
              <div className="text-center text-xs text-slate-400 mt-4">
                <SupportContact className="text-brand font-semibold" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
