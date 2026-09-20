import React, { useState, useEffect } from "react";
import { Bell, X, Check, Volume2, ShieldAlert, Navigation, Wrench, IndianRupee, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { WorkerAPI, WorkerJobAlertPreferences } from "../api/client";

interface Props {
  onClose: () => void;
  onSaved?: (prefs: WorkerJobAlertPreferences) => void;
}

export default function WorkerNotificationPreferencesModal({ onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [radius, setRadius] = useState(15);
  const [skillsOnly, setSkillsOnly] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [minJobAmount, setMinJobAmount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    void WorkerAPI.getNotificationPreferences()
      .then((res) => {
        if (!mounted) return;
        const p = res.preferences;
        if (p) {
          setRadius(p.nearbyRadiusKm ?? 15);
          setSkillsOnly(Boolean(p.skillsOnly));
          setEmergencyAlerts(p.emergencyAlerts !== false);
          setMinJobAmount(p.minJobAmount ?? 0);
          setSoundEnabled(p.soundEnabled !== false);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load preferences");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = {
        nearbyRadiusKm: radius,
        skillsOnly,
        emergencyAlerts,
        minJobAmount,
        soundEnabled,
      };
      await WorkerAPI.updateNotificationPreferences(updated);
      setSuccess(true);
      if (onSaved) onSaved(updated);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Job Alert Preferences</h3>
              <p className="text-xs text-slate-500">Fine-tune when and how you receive leads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-brand" />
            <p className="text-xs text-slate-500">Loading alert preferences...</p>
          </div>
        ) : (
          <div className="p-5 space-y-5 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Preferences saved successfully!</span>
              </div>
            )}

            {/* Alert Radius */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-brand" />
                  Dispatch Radius
                </label>
                <span className="text-sm font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full">
                  {radius} km
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-brand h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>2 km (Local neighborhood)</span>
                <span>40 km (Wider metro)</span>
              </div>
            </div>

            {/* Min Job Value */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                Minimum Job Budget (₹)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={minJobAmount}
                  onChange={(e) => setMinJobAmount(Math.max(0, Number(e.target.value)))}
                  className="w-32 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
                <span className="text-xs text-slate-500">
                  {minJobAmount === 0 ? "Alert on any job budget" : `Only alert for jobs ₹${minJobAmount}+`}
                </span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Filter & Sound Options
              </label>

              {/* Skills only */}
              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={skillsOnly}
                  onChange={(e) => setSkillsOnly(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-brand accent-brand"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-slate-600" />
                    Verified Skills Only
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only notify me when the job matches my verified categories and passport skills.
                  </p>
                </div>
              </label>

              {/* Emergency alerts */}
              <label className="flex items-start gap-3 p-3 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-2xl cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={emergencyAlerts}
                  onChange={(e) => setEmergencyAlerts(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-rose-600 accent-rose-600"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    High-Priority Emergency Leads
                  </div>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Always notify immediately for burst pipes, lockouts, and urgent hazards.
                  </p>
                </div>
              </label>

              {/* Sound alert */}
              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-brand accent-brand"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-slate-600" />
                    Sound Chime on Incoming Leads
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Play an audible ringtone when a high-match job arrives nearby.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
