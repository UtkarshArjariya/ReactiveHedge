"use client";

import { Card, Chip, Stat } from "../ui";
import { InlineError, SectionLabel, SkeletonLines, Tile, TileGrid } from "./parts";
import { fmtEth, fmtNum, fmtPct, fmtUsd } from "./format";
import type { DashboardView } from "./useDashboardData";

/**
 * POSITION PANEL — the LP's ETH/USDC position at a glance: value, current IL,
 * protection status, plus the running hedge. Protection reads mint when the
 * position is covered, amber while drift is building toward the threshold.
 */
export function PositionPanel({ view, onRetry }: { view: DashboardView; onRetry: () => void }) {
  const loading = view.stateStatus === "loading";
  const errored = view.stateStatus === "error";

  return (
    <Card className="p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Position · ETH/USDC LP</SectionLabel>
          <p className="font-mono text-[11px] tracking-[0.04em] text-ash">
            Cross-chain impermanent-loss protection · {view.mode === "demo" ? "demo loop" : "live testnet"}
          </p>
        </div>
        {loading ? (
          <span className="h-6 w-32 rounded-sm bg-rule motion-safe:animate-pulse" aria-hidden />
        ) : errored ? null : (
          <Chip tone={view.protectionTone} dot>
            {view.protectionLabel}
          </Chip>
        )}
      </header>

      {errored ? (
        <div className="mt-5">
          <InlineError
            title="Position state unavailable"
            message={view.stateError || "Couldn't read pool state from the chain. Check the RPC endpoint, then retry."}
            onRetry={onRetry}
          />
        </div>
      ) : loading ? (
        <SkeletonLines rows={2} className="mt-6" />
      ) : (
        <TileGrid className="mt-5 grid-cols-2 lg:grid-cols-4">
          <Tile>
            <Stat label="Position value" value={fmtUsd(view.positionValue)} caption={fmtEth(view.positionEth, 1)} />
          </Tile>
          <Tile>
            <Stat
              label="Current IL"
              value={fmtPct(view.ilBps)}
              tone={view.protectionTone}
              caption={view.fired ? "hedge compressed" : "vs. HODL"}
            />
          </Tile>
          <Tile>
            <Stat
              label="Net hedge"
              value={fmtEth(view.netHedge)}
              tone={view.fired ? "hedge" : "default"}
              caption="on Base Sepolia"
            />
          </Tile>
          <Tile>
            <Stat label="Hedges fired" value={fmtNum(view.hedgesFired)} caption="lifetime" />
          </Tile>
        </TileGrid>
      )}
    </Card>
  );
}
