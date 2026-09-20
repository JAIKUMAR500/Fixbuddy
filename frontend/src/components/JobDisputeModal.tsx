import React, { useState } from "react";
import { AlertTriangle, X, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { SafetyAPI, uploadImage, mediaUrl } from "../api/client";

interface Props {
  requestId: string;
  jobCode?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASONS = [
  { id: "poor_service", label: "Poor Quality / Incomplete Work" },
  { id: "overcharging", label: "Billing or Overcharging Dispute" },
  { id: "worker_no_show", label: "Worker Did Not Show Up" },
  { id: "customer_unavailable", label: "Customer Not Reachable" },
  { id: "safety_concern", label: "Safety or Misconduct Concern" },
  { id: "property_damage", label: "Property Damage" },
  { id: "other", label: "Other Concern" },
];

export default function JobDisputeModal({ requestId, jobCode, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState(REASONS[0].id);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const remainingSlots = 3 - photos.length;
      const toUpload = Array.from(files).slice(0, remainingSlots);
      const uploaded: string[] = [];
      for (const f of toUpload) {
        const res = await uploadImage(f);
        uploaded.push(res.url);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await SafetyAPI.reportDispute({
        requestId,
        reason,
        description: description.trim(),
        photos,
      });
      setSubmitted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Report an Issue / Dispute</h3>
              {jobCode && <p className="text-xs text-slate-500">Job #{jobCode}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Report Submitted</h4>
            <p className="text-sm text-slate-600 max-w-xs mx-auto">
              Our safety and operations team has logged your complaint. We will review the details and contact both parties.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Issue Category
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
              >
                {REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Description of the Issue
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened in detail (minimum 10 characters)..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Supporting Evidence / Photos ({photos.length}/3)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={mediaUrl(url)} alt="Evidence" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand text-slate-400 hover:text-brand transition-colors bg-slate-50/50">
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] font-semibold mt-1">Upload</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handlePhotoUpload(e.target.files)}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Optional: Upload photos of incomplete work, receipts, or property damage.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                type="submit"
                loading={submitting}
                disabled={submitting || description.trim().length < 10}
              >
                Submit Report
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
