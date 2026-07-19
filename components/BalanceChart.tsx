"use client";

import { useEffect, useRef, useState } from "react";

interface Point { t: number; v: number }

// Single-series area chart (balance over time). One hue → no legend; the card
// title names the series. Crosshair + tooltip on hover, per the viz guidelines.
export default function BalanceChart({ points, symbol = "₦" }: { points: Point[]; symbol?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const h = 240;
  const pad = { t: 16, r: 16, b: 24, l: 16 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-500 dark:border-neutral-800">
        Not enough activity yet to chart. Add money to get started.
      </div>
    );
  }

  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const values = points.map((p) => p.v);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.v)}`).join(" ");
  const area = `${line} L ${x(points.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => pad.t + f * innerH);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - pad.l) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const fmt = (v: number) => symbol + v.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg width={w} height={h} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
        <defs>
          <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridYs.map((gy, i) => (
          <line key={i} x1={pad.l} x2={w - pad.r} y1={gy} y2={gy} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth={1} />
        ))}

        <path d={area} fill="url(#balFill)" />
        <path d={line} fill="none" className="stroke-emerald-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(points[hover].v)} r={4} className="fill-emerald-500 stroke-white dark:stroke-neutral-950" strokeWidth={2} />
          </>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900"
          style={{ left: `${(x(hover) / w) * 100}%`, top: 4 }}
        >
          <div className="font-semibold">{fmt(points[hover].v)}</div>
          <div className="text-neutral-500">{new Date(points[hover].t).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
