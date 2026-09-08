import React, { useEffect, useState } from "react";
import { View } from "../../types";

const stages = [
  { label: "Understanding your request…", progress: 20 },
  { label: "Finding nearby providers…", progress: 50 },
  { label: "Matching relevant businesses…", progress: 75 },
  { label: "Almost there…", progress: 90 },
  { label: "Solutions found!", progress: 100 },
];

export default function FindingSolutions({ navigate }: { navigate: (v: View) => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    stages.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setStage(i);
          if (i === stages.length - 1) {
            setTimeout(() => navigate("matched-providers"), 800);
          }
        }, i * 900)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-600 via-sky-700 to-blue-800 flex flex-col items-center justify-center text-white px-4">
      {/* Animated orb */}
      <div className="relative mb-12">
        <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center animate-pulse-ring absolute inset-0" />
        <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center relative z-10">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
            <span className="text-3xl animate-spin-slow">🔍</span>
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-black text-center mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
        Finding the right help<br />for you…
      </h1>
      <p className="text-sky-200 text-center mb-10 text-base">{stages[stage]?.label}</p>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="bg-white/20 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-700 ease-out"
            style={{ width: `${stages[stage]?.progress ?? 0}%` }}
          />
        </div>
        <div className="flex justify-between">
          {["Finding", "Matching", "Connecting"].map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${stage >= (i + 1) * 1.5 ? "bg-white text-sky-600 border-white" : "border-white/40 text-white/40"}`}>
                {stage >= (i + 1) * 1.5 ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${stage >= (i + 1) * 1.5 ? "text-white" : "text-white/50"}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
