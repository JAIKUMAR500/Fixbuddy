import React from "react";

type Series = { label: string; value: number };

export default function TrendLine({
  series,
  color = "#0056D2",
  height = 180,
  suffix = "",
}: {
  series: Series[];
  color?: string;
  height?: number;
  suffix?: string;
}) {
  const w = 640;
  const h = height;
  const pad = 28;
  const values = series.map((s) => s.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const pts = series.map((s, i) => {
    const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s.value - min) / span) * (h - pad * 2);
    return { x, y, ...s };
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = pts.length
    ? `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${h - pad} L ${pts[0].x.toFixed(1)} ${h - pad} Z`
    : "";

  if (!series.length) {
    return <p className="text-sm text-slate-500 py-10 text-center">No trend data yet.</p>;
  }

  return (
    <div className="w-full overflow-hidden animate-fade-in">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <defs>
          <linearGradient id={`g-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${color.replace("#", "")})`} className="animate-fade-in" />
        <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" className="trend-stroke" />
        {pts.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2" className="animate-pop" />
          </g>
        ))}
        {pts.map((p, i) =>
          i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1 ? (
            <text key={`${p.label}-t`} x={p.x} y={h - 8} textAnchor="middle" className="fill-slate-400" fontSize="11">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      <p className="text-xs text-slate-400 text-right">
        Latest {suffix}{series[series.length - 1]?.value ?? 0}
      </p>
    </div>
  );
}
