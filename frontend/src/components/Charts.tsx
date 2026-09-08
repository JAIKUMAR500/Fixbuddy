import React from "react";

export function dayLabel(id?: string | null) {
  if (!id) return "";
  const d = new Date(id);
  if (Number.isNaN(d.getTime())) return String(id).slice(-5);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ComboChart({
  bars,
  line,
  barLabel = "Revenue",
  lineLabel = "Jobs",
}: {
  bars: { label: string; value: number }[];
  line: { label: string; value: number }[];
  barLabel?: string;
  lineLabel?: string;
}) {
  const n = Math.max(bars.length, line.length, 1);
  const w = 720;
  const h = 260;
  const pad = { l: 40, r: 16, t: 20, b: 36 };
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const maxLine = Math.max(1, ...line.map((b) => b.value));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const gap = innerW / n;
  const barW = Math.max(8, gap * 0.45);

  const barX = (i: number) => pad.l + i * gap + (gap - barW) / 2;
  const barH = (v: number) => (v / maxBar) * innerH;
  const linePts = line.map((p, i) => {
    const x = pad.l + i * gap + gap / 2;
    const y = pad.t + innerH - (p.value / maxLine) * innerH;
    return { x, y, ...p };
  });
  const path = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  if (!bars.length && !line.length) {
    return <p className="text-sm text-slate-500 py-12 text-center">No analytics yet. Data appears as jobs come in.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + innerH * (1 - t)}
            y2={pad.t + innerH * (1 - t)}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        ))}
        {bars.map((b, i) => {
          const bh = barH(b.value);
          return (
            <rect
              key={`${b.label}-${i}`}
              x={barX(i)}
              y={pad.t + innerH - bh}
              width={barW}
              height={bh}
              rx="6"
              fill="#0056D2"
              opacity="0.85"
            />
          );
        })}
        <path d={path} fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        {linePts.map((p, i) => (
          <circle key={`p-${i}`} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#0056D2" strokeWidth="2" />
        ))}
        {bars.map((b, i) =>
          i % Math.ceil(n / 7) === 0 || i === n - 1 ? (
            <text key={`t-${i}`} x={barX(i) + barW / 2} y={h - 12} textAnchor="middle" fontSize="11" fill="#94A3B8">
              {b.label}
            </text>
          ) : null
        )}
      </svg>
      <div className="flex gap-4 justify-end text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand" /> {barLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> {lineLabel}</span>
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  center,
}: {
  segments: { label: string; value: number; color: string }[];
  center: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#E2E8F0" strokeWidth="16" />
          {segments.map((seg) => {
            const len = (seg.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={seg.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-black font-display text-slate-900">{center}</p>
        </div>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  up,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  up?: boolean;
  accent?: "brand" | "rose" | "emerald";
}) {
  const bar = accent === "rose" ? "bg-rose-500" : accent === "emerald" ? "bg-emerald-500" : "bg-brand";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black font-display text-slate-900">{value}</p>
      {hint != null && hint !== "" && (
        <p className={`text-xs mt-2 font-semibold ${up === false ? "text-rose-500" : "text-emerald-600"}`}>{hint}</p>
      )}
      <span className={`absolute bottom-0 left-0 right-0 h-1 ${bar}`} />
    </div>
  );
}
