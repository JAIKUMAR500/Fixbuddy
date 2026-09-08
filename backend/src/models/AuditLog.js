import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    adminName: { type: String, default: "System" },
    action: { type: String, required: true },
    target: { type: String, default: "" },
    ip: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
