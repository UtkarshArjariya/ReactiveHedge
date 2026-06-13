"use client";

import { Card, Chip } from "../ui";
import { InlineError, SectionLabel, SkeletonLines } from "./parts";
import { fmtNum } from "./format";
import type { DashboardView } from "./useDashboardData";

// Upper semicircle, radius 80 centered at (100,100). pathLength=100 → the fill
// is just "percent of threshold", no arc-length math.
const ARC = "M20,100 A80,80 0 0 1 180,100";

/**
 * DRIFT METER — the single gauge for the whole product's tension-and-release.
 * Amber fills toward the threshold as drift accumulates; the instant it crosses,
 * the gauge resolves to mint (hedge fired).
 */
export function DriftMeter({ view, onRetry }: { view: DashboardView; onRetry: () => void }) {
  const loading = view.stateStatus === "loading";
  const errored = view.stateStatus === "error";
  const pct = Math.round(Math.max(0, Math.min(1, view.driftRatio)) * 100);
  const resolved = view.crossed || view.fired;
  const signal = resolved ? "var(--hedge)" : "var(--drift)";

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Drift meter</SectionLabel>
        {!loading && !errored && (
          <Chip tone={resolved ? "hedge" : "drift"} dot>
            {resolved ? "threshold crossed" : "accumulating"}
          </Chip>
        )}
      </header>

      {errored ? (
        <div className="mt-5">
          <InlineError
            title="Drift state unavailable"
            message={view.stateError || "Couldn't read drift vs. threshold from the chain. Retry to resume the gauge."}
            onRetry={onRetry}
          />
        </div>
      ) : loading ? (
        <SkeletonLines rows={3} className="mt-8" />
      ) : (
        <div className="mt-2 flex grow flex-col items-center justify-center">
          <div className="relative w-full max-w-[260px]">
            <svg viewBox="0 0 200 116" className="block w-full" role="img" aria-label={`${pct} percent of drift threshold`}>
              <path d={ARC} fill="none" stroke="var(--rule)" strokeWidth={13} strokeLinecap="round" />
              <path
                d={ARC}
                fill="none"
                stroke={signal}
                strokeWidth={13}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset={100 - pct}
                style={{
                  transition: "stroke-dashoffset 0.5s ease, stroke 0.6s ease",
                  filter: resolved ? "drop-shadow(0 0 6px var(--hedge))" : "none",
                }}
              />
              {/* threshold marker at the top of the arc */}
              <circle cx={100} cy={20} r={3} fill={resolved ? "var(--hedge)" : "var(--ash)"} />
            </svg>
            <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
              <span
                className="font-mono text-4xl leading-none tabular-nums"
                style={{ color: signal, transition: "color 0.6s ease" }}
              >
                {pct}%
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ash">of threshold</span>
            </div>
          </div>

          <div className="mt-4 flex w-full items-center justify-between font-mono text-[11px] tabular-nums text-ash">
            <span>
              drift <span className="text-phosphor">{fmtNum(view.driftBps)}</span> bps
            </span>
            <span>
              threshold <span className="text-phosphor">{fmtNum(view.thresholdBps)}</span> bps
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
