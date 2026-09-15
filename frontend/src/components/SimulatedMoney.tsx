import React from "react";

export const SIMULATION_LABEL = "DEVELOPMENT / SIMULATED — NO REAL MONEY";

export function SimulatedMoneyBanner({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 ${className}`}>
      {SIMULATION_LABEL}
    </p>
  );
}
