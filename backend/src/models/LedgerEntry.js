import mongoose from "mongoose";
import { FINANCIAL_MODE, FINANCE_STATUS, LEDGER_TYPES, LIVE_LEDGER_TYPES } from "../services/payments/config.js";

const TYPES = [...Object.values(LEDGER_TYPES), ...Object.values(LIVE_LEDGER_TYPES)];
const STATUSES = Object.values(FINANCE_STATUS);

const ledgerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    counterpartyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: TYPES, required: true, index: true },
    amountPaise: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: STATUSES, default: FINANCE_STATUS.SIMULATED, index: true },
    financialMode: { type: String, default: FINANCIAL_MODE },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

ledgerSchema.index({ requestId: 1, type: 1 }, { unique: true, name: "one_ledger_type_per_job" });

export const LedgerEntry = mongoose.model("LedgerEntry", ledgerSchema);
