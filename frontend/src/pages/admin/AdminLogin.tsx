import React, { useState } from "react";
import { Copy, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { View } from "../../types";
import { Button, Input } from "../../components/ui";
import { useApp } from "../../api/AppContext";
import { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "../../api/brand";

export default function AdminLogin({ navigate }: { navigate: (v: View) => void }) {
  const { login, logout } = useApp();
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState(SUPER_ADMIN_PASSWORD);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(email, password, "admin");
      if (user.role !== "admin") {
        logout();
        setError("This login is for Super Admin only");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  const openForgot = () => {
    try {
      sessionStorage.setItem("fb_forgot", "1");
      sessionStorage.setItem("fb_forgot_email", email || SUPER_ADMIN_EMAIL);
    } catch {
      /* ignore */
    }
    navigate("login");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-navy p-10 text-white">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-brand text-white font-black flex items-center justify-center">F</span>
          <span className="text-xl font-bold font-display">FixBuddy Admin</span>
        </div>
        <div>
          <h2 className="text-4xl font-black font-display mb-3 leading-tight">Manage. Monitor. Build a better FixBuddy.</h2>
          <p className="text-slate-300 max-w-md">Control customers, workers, businesses, verification and platform operations from one portal.</p>
        </div>
        <p className="text-xs text-slate-500">Internal staff only</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <button onClick={() => navigate("landing")} className="text-sm text-slate-500 mb-6 hover:text-brand">← Back to FixBuddy</button>
          <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 mb-1">Admin Portal</h1>
          <p className="text-sm text-slate-500 mb-4">Super Admin login</p>
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 mb-5 text-sm">
            <p className="text-xs uppercase tracking-wide text-brand font-semibold mb-2">Login ID</p>
            <p className="font-mono text-slate-900 flex items-center justify-between gap-2">
              {SUPER_ADMIN_EMAIL}
              <button type="button" className="text-brand" onClick={() => void navigator.clipboard?.writeText(SUPER_ADMIN_EMAIL)}>
                <Copy className="w-4 h-4" />
              </button>
            </p>
            <p className="text-xs uppercase tracking-wide text-brand font-semibold mt-3 mb-2">Password</p>
            <p className="font-mono text-slate-900 flex items-center justify-between gap-2">
              {SUPER_ADMIN_PASSWORD}
              <button type="button" className="text-brand" onClick={() => void navigator.clipboard?.writeText(SUPER_ADMIN_PASSWORD)}>
                <Copy className="w-4 h-4" />
              </button>
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="relative">
              <Input label="Password" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-slate-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <label className="flex items-center gap-2"><input type="checkbox" /> Remember me</label>
              <button type="button" className="text-brand font-semibold" onClick={openForgot}>Forgot password?</button>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="primary" fullWidth size="lg" loading={submitting}>Sign In</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
