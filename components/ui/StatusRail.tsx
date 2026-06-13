"use client";

import { useEffect, useState } from "react";
import { cn } from "./cn";
import { Chip } from "./Chip";
import { Wordmark } from "./Wordmark";

/** "instrument" = the live app chrome (chips + readout). "brochure" = the lighter marketing chrome. */
export type StatusRailMode = "instrument" | "brochure";

export interface StatusRailProps extends React.HTMLAttributes<HTMLElement> {
  /** Chrome variant. Defaults to the live instrument panel. */
  mode?: StatusRailMode;
  /** Network label shown in the rail. Defaults to the pool chain. */
  network?: string;
  chainId?: number;
  /** Whether the monitor reads as live. Placeholder until wired to chain state. */
  monitoring?: boolean;
  /**
   * Right-aligned slot. In "instrument" mode this is the wallet connect control
   * (wired in a later prompt); in "brochure" mode it's the single "Launch app" action.
   */
  actions?: React.ReactNode;
  /**
   * Optional replacement for the leading network chip (instrument mode only).
   * The app surface passes a live, wallet-aware chip here; left undefined the rail
   * falls back to the static `network`/`chainId` readout. Kept as a slot so this
   * shared rail never imports wallet hooks — the marketing surface has no provider.
   */
  networkSlot?: React.ReactNode;
}

// Placeholder seed so SSR and first client render match (no hydration drift);
// the counter then ticks client-side only. Real block height arrives via /api/state later.
const SEED_BLOCK = 12_840_517;

/**
 * Thin top status rail — the instrument-panel replacement for a centered navbar.
 * Wordmark left; the right side adapts to `mode`:
 *   - instrument: mono status chips (network, a mint monitoring pulse, a ticking
 *     block-height readout) plus an `actions` slot for the wallet button.
 *   - brochure: no live status — just the `actions` slot (the "Launch app" button).
 */
export function StatusRail({
  mode = "instrument",
  network = "Unichain Sepolia",
  chainId = 1301,
  monitoring = true,
  actions,
  networkSlot,
  className,
  ...props
}: StatusRailProps) {
  const [block, setBlock] = useState(SEED_BLOCK);

  useEffect(() => {
    // Only the instrument panel carries a live readout.
    if (mode !== "instrument") return;
    // ~1 new block / 2s — a quiet, believable tick. Respect reduced motion by holding still.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setBlock((b) => b + 1), 2000);
    return () => window.clearInterval(id);
  }, [mode]);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-rule bg-ink px-4 py-3 sm:px-6",
        className,
      )}
      {...props}
    >
      <a
        href="/"
        aria-label="ReactiveHedge home"
        className={cn(
          "rounded",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        )}
      >
        <Wordmark />
      </a>

      <div className="flex items-center gap-2 sm:gap-3">
        {mode === "instrument" && (
          <>
            {networkSlot ?? (
              <Chip className="hidden sm:inline-flex">
                {network} <span className="text-ash">·</span> {chainId}
              </Chip>
            )}
            {/* Status chips are supplementary; collapse them below sm so the rail
                stays to wordmark + wallet at ~375px (the dashboard body carries
                the live mode chip). */}
            <Chip tone={monitoring ? "hedge" : "default"} dot={monitoring} className="hidden sm:inline-flex">
              {monitoring ? "Monitoring" : "Idle"}
            </Chip>
            {/* Block readout is supplementary — drop it below sm so the rail
                (wordmark + status + wallet) never crowds at ~375px. */}
            <Chip aria-label={`Latest block ${block}`} className="hidden sm:inline-flex">
              <span className="text-ash">BLK</span>
              {block.toLocaleString("en-US")}
            </Chip>
          </>
        )}
        {actions}
      </div>
    </header>
  );
}
