import React, { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { JobRequest } from "../api/client";
import { canCancelJob, statusLabel } from "../api/jobLock";

const WORKER_REASONS = [
  "Emergency",
  "Customer requested cancellation",
  "Wrong job information",
  "Unsafe location",
  "Vehicle problem",
  "Personal emergency",
  "Other",
];

const CUSTOMER_REASONS = [
  "Changed plans",
  "Worker delayed",
  "Found another option",
  "Wrong location",
  "Other",
];

export default function CancelJobPanel({
  worker,
  job,
  policy,
  busy,
  onCancel,
  variant = "panel",
}: {
  worker: boolean;
  job: Pick<JobRequest, "id" | "code" | "category" | "description" | "status">;
  policy?: JobRequest["cancelPolicy"] | null;
  busy?: boolean;
  onCancel: (reason: string) => void;
  variant?: "panel" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reasons = worker ? WORKER_REASONS : CUSTOMER_REASONS;

  if (!canCancelJob(job.status)) return null;

  const dialog = (
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Cancel this job?</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5, pt: "8px !important" }}>
        <Typography variant="body2" color="text.secondary">
          {job.category} · {job.code} · {statusLabel(job.status)}
        </Typography>
        <Alert severity="warning">
          {policy?.text || "You can cancel once, including after arrival or after work starts. After that this job is closed."}
        </Alert>
        <FormControl fullWidth>
          <InputLabel id={`cancel-reason-${job.id}-${variant}`}>Why are you cancelling?</InputLabel>
          <Select
            labelId={`cancel-reason-${job.id}-${variant}`}
            label="Why are you cancelling?"
            value={reason}
            onChange={(e) => setReason(String(e.target.value))}
          >
            {reasons.map((row) => (
              <MenuItem key={row} value={row}>
                {row}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          This cannot be undone. One cancel closes this job for both sides. It does not close your account.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={() => setOpen(false)}>
          Keep job
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy || !reason}
          onClick={() => onCancel(reason)}
        >
          {busy ? "Cancelling..." : "Confirm cancel"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const trigger = (
    <Button
      color="error"
      variant={variant === "button" ? "outlined" : "contained"}
      disabled={busy}
      startIcon={<CloseIcon />}
      onClick={() => setOpen(true)}
      fullWidth={variant !== "button"}
    >
      Cancel job
    </Button>
  );

  if (variant === "button") {
    return (
      <>
        {trigger}
        {dialog}
      </>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: "error.light", bgcolor: "#FEF2F2" }}>
      <Typography variant="overline" color="error" sx={{ letterSpacing: 1.1 }}>
        Cancel this job
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {job.category}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {job.code} · {statusLabel(job.status)}. This action is only for this job, not your whole account.
      </Typography>
      {trigger}
      {dialog}
    </Paper>
  );
}
