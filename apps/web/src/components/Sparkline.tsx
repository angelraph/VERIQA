"use client";

import { useId, useState } from "react";

export function Sparkline({ values, max, height = 56 }: { values: number[]; max?: number; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 300;
  const top = max ?? Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - (v / top) * (height - 6) - 3}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-14 w-full" preserveAspectRatio="none" role="img" aria-label="Trend">
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3d6bff" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(" ")} fill="none" stroke={`url(#sp${id})`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/// Area chart with a hover readout.
export function AreaChart({
  points,
  height = 180,
  format = (n) => String(n),
}: {
  points: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="grid h-40 place-items-center text-sm text-ink-400">Not enough data yet</div>;
  const w = 600;
  const top = Math.max(...points.map((p) => p.value), 1) * 1.15;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => height - (v / top) * height;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" L");
  const h = hover ?? points.length - 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)))));
        }}
        role="img"
        aria-label="Chart"
      >
        <defs>
          <linearGradient id={`af${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity="0.25" />
            <stop offset="1" stopColor="#3d6bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`al${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#3d6bff" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={height * g} y2={height * g} stroke="#ecebf5" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`M${line} L${w},${height} L0,${height} Z`} fill={`url(#af${id})`} />
        <path d={`M${line}`} fill="none" stroke={`url(#al${id})`} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <line x1={x(h)} x2={x(h)} y1="0" y2={height} stroke="#c4b5fd" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs text-white shadow-lift"
        style={{ left: `${(h / (points.length - 1)) * 100}%` }}
      >
        <div className="text-white/60">{points[h].label}</div>
        <div className="font-semibold">{format(points[h].value)}</div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-400">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

export function Bars({ values, height = 96 }: { values: { label: string; value: number }[]; height?: number }) {
  const top = Math.max(...values.map((v) => v.value), 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v) => (
        <div key={v.label} className="group relative flex h-full flex-1 items-end">
          <div className="w-full rounded-t-[4px] bg-gradient-to-t from-violet-500 to-electric-400 opacity-85 transition group-hover:opacity-100" style={{ height: Math.max(3, (v.value / top) * height) }} />
          <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] text-white group-hover:block">
            {v.label}: {v.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/// Horizontal split bar, like a payment-type breakdown.
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
        {parts.map((p) => (
          <div key={p.label} className="h-full transition-[width] duration-700" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="font-semibold text-ink-800">{Math.round((p.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
