"use client";

import { Card } from "../ui";
import { InlineError, SectionLabel, SkeletonLines } from "./parts";
import { fmtNum, fmtPct } from "./format";
import type { Backtest, DashboardView } from "./useDashboardData";

/**
 * BACKTEST STRIP — compact proof: a two-line sparkline (unhedged amber vs.
 * hedged mint, gap = IL prevented) and the 2.02% → 0.14% / 93% readout, kept
 * consistent with the marketing proof section.
 */
export function BacktestStrip({ view, onRetry }: { view: DashboardView; onRetry: () => void }) {
  const { backtest, backtestStatus, backtestError } = view;

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Backtest · 30-day ETH/USDC</SectionLabel>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ash">cumulative IL</span>
      </header>

      <div className="mt-4 grow">
        {backtestStatus === "loading" ? (
          <SkeletonLines rows={3} />
        ) : backtestStatus === "error" || !backtest ? (
          <InlineError title="Backtest unavailable" message={backtestError || "CSV read failed."} onRetry={onRetry} />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Sparkline rows={backtest.rows} className="h-20 w-full sm:max-w-[280px]" />
            <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-2">
              <div className="font-mono text-2xl leading-none tabular-nums">
                <span className="text-drift">{fmtPct(backtest.unhedgedBps)}</span>
                <span className="mx-2 text-ash">→</span>
                <span className="text-hedge">{fmtPct(backtest.hedgedBps)}</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ash">
                <span className="text-hedge">{fmtNum(backtest.reduction)}%</span> less impermanent loss
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Sparkline({ rows, className }: { rows: Backtest["rows"]; className?: string }) {
  if (!rows.length) return null;
  const w = 280;
  const h = 80;
  const pad = 4;
  const maxBps = Math.max(...rows.map((r) => Math.max(r.unhedged_bps, r.hedged_bps)), 1);
  const n = Math.max(rows.length - 1, 1);
  const x = (i: number) => pad + (i / n) * (w - pad * 2);
  const y = (bps: number) => pad + (1 - bps / maxBps) * (h - pad * 2);
  const line = (key: "unhedged_bps" | "hedged_bps") =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");
  const unhedged = line("unhedged_bps");
  const hedged = line("hedged_bps");
  const gap = `${unhedged} ${rows
    .map((_, i) => rows.length - 1 - i)
    .map((idx) => `L${x(idx).toFixed(1)},${y(rows[idx].hedged_bps).toFixed(1)}`)
    .join(" ")} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} role="img" aria-label="Backtest sparkline: unhedged vs. hedged impermanent loss">
      <path d={gap} fill="var(--drift)" fillOpacity={0.12} />
      <path d={unhedged} fill="none" stroke="var(--drift)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={hedged} fill="none" stroke="var(--hedge)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
