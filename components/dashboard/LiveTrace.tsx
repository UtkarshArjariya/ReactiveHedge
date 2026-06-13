"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Chip } from "../ui";
import { Trace } from "../Trace";
import { InlineError, SectionLabel, SkeletonLines } from "./parts";
import type { DashboardView } from "./useDashboardData";

const STAGE_CHIP: Record<DashboardView["stage"], { label: string; tone: "default" | "hedge" | "drift" | "loss" }> = {
  listening: { label: "listening", tone: "default" },
  observed: { label: "drift observed", tone: "drift" },
  breached: { label: "threshold breached", tone: "drift" },
  hedged: { label: "hedge fired", tone: "hedge" },
  stalled: { label: "degraded", tone: "loss" },
};

/**
 * LIVE TRACE — the signature instrument as the live position chart. The two
 * paths are the observed (faster venue) price vs. the pool price; the amber gap
 * widens as drift accrues and snaps shut to mint the instant a hedge fires.
 *
 * Drives a single eased `display` value toward the target divergence so live
 * (5s poll) and demo (per-frame) both render a smooth widen-then-converge.
 */
export function LiveTrace({ view, onRetry }: { view: DashboardView; onRetry: () => void }) {
  const loading = view.stateStatus === "loading";
  const errored = view.stateStatus === "error";
  const target = view.fired ? 0 : view.driftRatio;
  const [display, setDisplay] = useState(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(targetRef.current);
      return;
    }
    let raf = 0;
    const tick = () => {
      setDisplay((cur) => {
        const next = cur + (targetRef.current - cur) * 0.12;
        return Math.abs(targetRef.current - next) < 0.001 ? targetRef.current : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const chip = STAGE_CHIP[view.stage];

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Live position trace</SectionLabel>
        {!errored && (
          <Chip tone={chip.tone} dot={chip.tone === "hedge" || chip.tone === "drift"}>
            {chip.label}
          </Chip>
        )}
      </header>

      {errored ? (
        <div className="mt-5 grow">
          <InlineError
            title="Trace paused"
            message={view.stateError || "Live drift state stopped loading. Retry to resume the position trace."}
            onRetry={onRetry}
          />
        </div>
      ) : loading ? (
        <SkeletonLines rows={4} className="mt-6 grow" />
      ) : (
        <div className="mt-5 grow">
          <Trace progress={display} fired={view.fired} height={224} label className="w-full" />
        </div>
      )}

      {!errored && (
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-4" style={{ background: "var(--phosphor)" }} aria-hidden /> observed price
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-4" style={{ background: "var(--phosphor)" }} aria-hidden /> pool price
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: view.fired ? "var(--hedge)" : "var(--drift)", transition: "background 0.6s ease" }}
            aria-hidden
          />
          gap = {view.fired ? "protected" : "IL accruing"}
        </span>
      </div>
      )}
    </Card>
  );
}
