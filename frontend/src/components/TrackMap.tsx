import React from "react";
import { Alert, Box, Button, Chip, Paper, Typography } from "@mui/material";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import NavigationIcon from "@mui/icons-material/Navigation";
import { mapsNavUrl } from "../api/geo";

type Point = { lat?: number | null; lng?: number | null } | null | undefined;

function valid(point: Point) {
  return point?.lat != null && point?.lng != null ? { lat: point.lat, lng: point.lng } : null;
}

function embedUrl(dest: { lat: number; lng: number }, origin?: { lat: number; lng: number } | null) {
  if (origin) {
    return `https://maps.google.com/maps?saddr=${origin.lat},${origin.lng}&daddr=${dest.lat},${dest.lng}&output=embed`;
  }
  return `https://maps.google.com/maps?q=${dest.lat},${dest.lng}&z=15&output=embed`;
}

export default function TrackMap({
  customer,
  worker,
  className = "",
  navigateTo,
  origin,
  tapHint,
}: {
  customer?: Point;
  worker?: Point;
  className?: string;
  navigateTo?: Point;
  origin?: Point;
  tapHint?: string;
}) {
  const dest =
    valid(navigateTo) || valid(customer) || valid(worker);
  const from = valid(origin);
  const customerPoint = valid(customer);
  const workerPoint = valid(worker);

  if (!dest) {
    return (
      <Paper variant="outlined" className={className} sx={{ p: 3, textAlign: "center", bgcolor: "background.default" }}>
        <MapOutlinedIcon color="primary" sx={{ fontSize: 36, mb: 1 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Map for this job
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Location will appear here once GPS is available for this job. Cancel is only shown on jobs that can still be cancelled.
        </Typography>
      </Paper>
    );
  }

  const href = mapsNavUrl(dest, from);
  const src = embedUrl(dest, from);

  return (
    <Paper variant="outlined" className={className} sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2, lineHeight: 1.2 }}>
            Live map
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            {customerPoint && <Chip size="small" color="info" label="Customer" />}
            {workerPoint && <Chip size="small" color="success" label="Worker" />}
          </Box>
        </Box>
        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
          {tapHint || "Job location"}
        </Typography>
      </Box>
      <Box sx={{ height: 240, bgcolor: "#e8eef6" }}>
        <iframe
          title="Job map"
          src={src}
          width="100%"
          height="240"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </Box>
      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="contained" href={href} target="_blank" rel="noopener noreferrer" startIcon={<NavigationIcon />}>
          Open in Google Maps
        </Button>
        <Alert severity="info" sx={{ mt: 1.5 }}>
          This map belongs to this job only. Use Google Maps for turn-by-turn directions, then return here for OTP and job actions.
        </Alert>
      </Box>
    </Paper>
  );
}
