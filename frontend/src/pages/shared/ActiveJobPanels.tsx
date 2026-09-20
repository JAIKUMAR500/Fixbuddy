import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  X,
  Clock,
  Wrench,
  Camera,
  Calendar,
  IndianRupee,
  AlertTriangle,
  RefreshCw,
  Package,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { Button, Card } from "../../components/ui";
import {
  RequestAPI,
  uploadImage,
  mediaUrl,
  type JobRequest,
  type PriceChangeRequest,
  type MaterialRequest,
} from "../../api/client";
import { formatRupees } from "../../api/money";

// ─── Price Change Modal (Worker) ─────────────────────────────────────────────
interface PriceChangeModalProps {
  job: JobRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceChangeModal({ job, onClose, onSuccess }: PriceChangeModalProps) {
  const currentPrice = job.finalBill?.totalAmount ?? job.estimatedAmount;
  const [requestedAmount, setRequestedAmount] = useState(String(currentPrice + 200));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(requestedAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid requested amount.");
      return;
    }
    if (amt === currentPrice) {
      setError("Requested amount must be different from current amount.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for the price adjustment.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await RequestAPI.requestPriceChange(job.id, { requestedAmount: amt, reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit price change request");
    } finally {
      setSubmitting(false);
    }
  };

  const diff = Number(requestedAmount || 0) - currentPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand">
            <IndianRupee className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">Request Price Change</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Request additional charges if unexpected work or higher complexity is discovered on-site. The customer must approve the change.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center text-xs">
            <span className="text-slate-500">Current Base / Total</span>
            <span className="font-bold text-slate-800">{formatRupees(currentPrice)}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              New Total Amount (₹)
            </label>
            <input
              type="number"
              min={1}
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
            />
            {diff !== 0 && (
              <p className={`text-xs font-semibold mt-1 ${diff > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {diff > 0 ? `+${formatRupees(diff)} extra` : `${formatRupees(diff)} discount`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Adjustment
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Discovered concealed pipe leak behind wall requiring 2 extra hours"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Send to Customer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Price Change Customer Approval Card ─────────────────────────────────────
interface PriceChangeCardProps {
  job: JobRequest;
  request: PriceChangeRequest;
  onRefresh: () => void;
}

export function PriceChangeCard({ job, request, onRefresh }: PriceChangeCardProps) {
  const [responding, setResponding] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [error, setError] = useState("");

  const handleRespond = async (action: "approve" | "reject") => {
    setResponding(true);
    setError("");
    try {
      await RequestAPI.respondPriceChange(job.id, request.id, { action, customerNote });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  if (request.status !== "pending") return null;

  return (
    <Card padding="md" className="border-amber-200 bg-amber-50/60 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
            ₹
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Worker Requested Price Adjustment</h4>
            <p className="text-[11px] text-slate-500">
              {request.requestedAt ? new Date(request.requestedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now"}
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
          Pending Approval
        </span>
      </div>

      <div className="p-3 bg-white rounded-xl border border-amber-100 text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-slate-500">Original / Current:</span>
          <span className="font-semibold text-slate-700">{formatRupees(request.originalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Requested Total:</span>
          <span className="font-bold text-slate-900 text-sm">{formatRupees(request.requestedAmount)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-slate-100">
          <span className="font-semibold text-amber-700">Difference:</span>
          <span className="font-bold text-amber-800">
            {request.difference >= 0 ? `+${formatRupees(request.difference)}` : formatRupees(request.difference)}
          </span>
        </div>
        <div className="pt-1 text-slate-600">
          <strong>Reason:</strong> {request.reason}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        type="text"
        placeholder="Optional note to worker..."
        value={customerNote}
        onChange={(e) => setCustomerNote(e.target.value)}
        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand"
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-slate-300 text-slate-700 hover:bg-white"
          disabled={responding}
          onClick={() => handleRespond("reject")}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          loading={responding}
          disabled={responding}
          onClick={() => handleRespond("approve")}
        >
          Approve {request.difference >= 0 ? `+${formatRupees(request.difference)}` : ""}
        </Button>
      </div>
    </Card>
  );
}

// ─── Material Request Modal (Worker) ─────────────────────────────────────────
interface MaterialRequestModalProps {
  job: JobRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export function MaterialRequestModal({ job, onClose, onSuccess }: MaterialRequestModalProps) {
  const [itemName, setItemName] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await uploadImage(file);
      setReceiptPhoto(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError("Please specify the material or spare part name.");
      return;
    }
    const cost = Number(estimatedCost);
    if (!cost || cost <= 0) {
      setError("Please enter a valid estimated cost.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await RequestAPI.requestMaterial(job.id, {
        itemName: itemName.trim(),
        estimatedCost: cost,
        receiptPhoto: receiptPhoto || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit material request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand">
            <Package className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">Request Material / Parts</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Request customer approval before purchasing parts or replacement hardware. Approved materials are added to the final bill.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Item / Spare Part Name
            </label>
            <input
              type="text"
              placeholder="e.g., Brass Ball Valve 1/2 inch + Teflon tape"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Estimated Cost (₹)
            </label>
            <input
              type="number"
              min={1}
              placeholder="e.g., 350"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Receipt / Estimate Photo (Optional)
            </label>
            {receiptPhoto ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                <img src={mediaUrl(receiptPhoto)} alt="Receipt" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setReceiptPhoto("")}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-600 hover:border-brand cursor-pointer">
                <Camera className="w-4 h-4 text-slate-400" />
                <span>{uploading ? "Uploading…" : "+ Attach store receipt or part photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhoto(e.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Send Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Material Request Customer Card ──────────────────────────────────────────
interface MaterialRequestCardProps {
  job: JobRequest;
  material: MaterialRequest;
  onRefresh: () => void;
}

export function MaterialRequestCard({ job, material, onRefresh }: MaterialRequestCardProps) {
  const [responding, setResponding] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [error, setError] = useState("");

  const handleRespond = async (action: "approve" | "reject") => {
    setResponding(true);
    setError("");
    try {
      await RequestAPI.respondMaterial(job.id, material.id, { action, customerNote });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  if (material.status !== "pending") return null;

  return (
    <Card padding="md" className="border-sky-200 bg-sky-50/60 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Material / Parts Approval Needed</h4>
            <p className="text-[11px] text-slate-500">Worker requested parts purchase for this job</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-200 text-sky-900 uppercase">
          Approval Needed
        </span>
      </div>

      <div className="p-3 bg-white rounded-xl border border-sky-100 text-xs space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-slate-800 text-sm">{material.itemName}</span>
          <span className="font-bold text-brand text-sm">{formatRupees(material.estimatedCost)}</span>
        </div>
        {material.receiptPhoto && (
          <div className="pt-1">
            <p className="text-[10px] text-slate-400 mb-1">Receipt / Part Photo:</p>
            <img
              src={mediaUrl(material.receiptPhoto)}
              alt="Receipt"
              className="w-20 h-20 rounded-lg object-cover border border-slate-200"
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        type="text"
        placeholder="Optional note to worker..."
        value={customerNote}
        onChange={(e) => setCustomerNote(e.target.value)}
        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand"
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-slate-300 text-slate-700 hover:bg-white"
          disabled={responding}
          onClick={() => handleRespond("reject")}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1 bg-brand text-white"
          loading={responding}
          disabled={responding}
          onClick={() => handleRespond("approve")}
        >
          Approve {formatRupees(material.estimatedCost)}
        </Button>
      </div>
    </Card>
  );
}

// ─── Final Bill Card with Customer Confirmation ──────────────────────────────
interface FinalBillCardProps {
  job: JobRequest;
  isWorker: boolean;
  onRefresh: () => void;
}

export function FinalBillCard({ job, isWorker, onRefresh }: FinalBillCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const bill = job.finalBill;
  const baseAmt = bill?.baseAmount ?? job.estimatedAmount;
  const priceChange = bill?.approvedPriceChange ?? 0;
  const materials = bill?.approvedMaterials ?? 0;
  const total = bill?.totalAmount ?? (baseAmt + priceChange + materials);
  const isConfirmed = Boolean(bill?.confirmedByCustomer);

  const handleConfirm = async () => {
    setConfirming(true);
    setError("");
    try {
      await RequestAPI.confirmBill(job.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm bill");
    } finally {
      setConfirming(false);
    }
  };

  // Only show breakdown if there are extra approved items or job is completed/ready for bill
  const hasExtras = priceChange !== 0 || materials > 0;
  const showCard = hasExtras || job.status === "completed" || job.status === "in_progress";

  if (!showCard) return null;

  return (
    <Card padding="md" className="border-slate-200 space-y-3 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-brand" />
          <h4 className="font-bold text-slate-900 text-sm">Itemized Final Bill</h4>
        </div>
        {isConfirmed ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <Check className="w-3 h-3" /> Confirmed
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            Pending Confirmation
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Base Labor / Service</span>
          <span>{formatRupees(baseAmt)}</span>
        </div>

        {priceChange !== 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Approved Scope Changes</span>
            <span className={priceChange > 0 ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
              {priceChange > 0 ? `+${formatRupees(priceChange)}` : formatRupees(priceChange)}
            </span>
          </div>
        )}

        {materials > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Approved Materials / Parts</span>
            <span className="text-brand font-semibold">+{formatRupees(materials)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
          <span className="font-bold text-slate-900">Total Bill Amount</span>
          <span className="font-extrabold text-slate-900 text-base">{formatRupees(total)}</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!isWorker && !isConfirmed && (
        <div className="pt-2 border-t border-slate-100">
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={confirming}
            disabled={confirming}
            onClick={handleConfirm}
          >
            Confirm Final Amount · {formatRupees(total)}
          </Button>
          <p className="text-[11px] text-slate-400 text-center mt-1">
            Verifying ensures total clarity before simulated payment collection.
          </p>
        </div>
      )}

      {isWorker && !isConfirmed && hasExtras && (
        <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl">
          Customer will confirm this breakdown of {formatRupees(total)} before payment collection.
        </p>
      )}
    </Card>
  );
}

// ─── Handover Modal (Worker) ─────────────────────────────────────────────────
interface HandoverModalProps {
  job: JobRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export function HandoverModal({ job, onClose, onSuccess }: HandoverModalProps) {
  const [reason, setReason] = useState<"emergency" | "skill_mismatch" | "equipment_failure" | "delay">("emergency");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await RequestAPI.handover(job.id, { reason, note });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handover failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600">
            <RefreshCw className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">Handover Job</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Releases your active assignment lock cleanly. The customer will be returned to the dispatch queue and matched with another available worker.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleHandover} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Handover Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
            >
              <option value="emergency">Personal Emergency / Health</option>
              <option value="skill_mismatch">Specialist Skill Mismatch Required</option>
              <option value="equipment_failure">Tool / Equipment Failure</option>
              <option value="delay">Severe Transit Delay</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Note for Support & Next Worker
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide context on work completed or special tools required..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit" loading={submitting}>
              Confirm Handover
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── No-Show / Customer Unavailable Modal ─────────────────────────────────────
interface NoShowModalProps {
  job: JobRequest;
  isWorker: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NoShowModal({ job, isWorker, onClose, onSuccess }: NoShowModalProps) {
  const [action, setAction] = useState<"rematch" | "cancel">("rematch");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (isWorker) {
        await RequestAPI.customerUnavailable(job.id, { note: reason });
      } else {
        await RequestAPI.reportNoShow(job.id, { action, reason });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">
              {isWorker ? "Customer Unavailable" : "Report Worker No-Show"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {isWorker
            ? "Report that the customer is unreachable or not at the service location after your arrival."
            : "If the worker has exceeded arrival time and is unreachable, choose how you want to proceed."}
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isWorker && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                What would you like to do?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAction("rematch")}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    action === "rematch"
                      ? "border-brand bg-brand-soft text-brand ring-2 ring-brand"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div>Find Another Worker</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Instant re-dispatch</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAction("cancel")}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    action === "cancel"
                      ? "border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-400"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div>Cancel Job</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Zero cancellation fee</div>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Details / Note
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isWorker ? "Door locked, tried calling customer 3 times..." : "Worker did not answer call, 30 min overdue..."}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Back
            </Button>
            <Button variant="danger" size="sm" type="submit" loading={submitting}>
              Submit Report
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reschedule Modal (Customer) & Card (Worker) ─────────────────────────────
interface RescheduleModalProps {
  job: JobRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export function RescheduleModal({ job, onClose, onSuccess }: RescheduleModalProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError("Please select a new date.");
      return;
    }
    const isoDate = new Date(`${date}T${time || "10:00"}`).toISOString();
    setSubmitting(true);
    setError("");
    try {
      await RequestAPI.requestReschedule(job.id, { requestedDate: isoDate, reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request reschedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand">
            <Calendar className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">Reschedule Service</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Propose a new date and time. Your assigned worker will receive an alert to accept or reject the new time.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">New Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">New Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Reschedule
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Unplanned travel, need service tomorrow morning instead"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Send Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reschedule Worker Banner ────────────────────────────────────────────────
interface RescheduleWorkerCardProps {
  job: JobRequest;
  onRefresh: () => void;
}

export function RescheduleWorkerCard({ job, onRefresh }: RescheduleWorkerCardProps) {
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState("");

  const req = job.rescheduleRequest;
  if (!req || req.status !== "pending") return null;

  const handleRespond = async (action: "accept" | "reject") => {
    setResponding(true);
    setError("");
    try {
      await RequestAPI.respondReschedule(job.id, { action });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  return (
    <Card padding="md" className="border-amber-200 bg-amber-50 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-amber-600" />
        <h4 className="font-bold text-slate-900 text-sm">Customer Requested Reschedule</h4>
      </div>

      <div className="text-xs space-y-1 text-slate-700">
        <p>
          <strong>Proposed Date & Time:</strong>{" "}
          {req.requestedDate ? new Date(req.requestedDate).toLocaleString("en-IN") : "—"}
        </p>
        {req.reason && (
          <p>
            <strong>Reason:</strong> {req.reason}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={responding}
          onClick={() => handleRespond("reject")}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          loading={responding}
          disabled={responding}
          onClick={() => handleRespond("accept")}
        >
          Accept New Time
        </Button>
      </div>
    </Card>
  );
}
