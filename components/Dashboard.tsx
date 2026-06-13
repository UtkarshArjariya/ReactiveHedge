"use client";

import { Button, Chip } from "./ui";
import { config } from "../lib/config";
import { useDashboardData } from "./dashboard/useDashboardData";
import { SectionLabel } from "./dashboard/parts";
import { PositionPanel } from "./dashboard/PositionPanel";
import { LiveTrace } from "./dashboard/LiveTrace";
import { DriftMeter } from "./dashboard/DriftMeter";
import { EventFeed } from "./dashboard/EventFeed";
import { BacktestStrip } from "./dashboard/BacktestStrip";

/**
 * The live LP dashboard at /app — instrument-panel layout wired to
 * /api/{state,events,backtest}. When the chain env is blank, the whole surface
 * runs on a self-contained demo loop (drift builds → callback → hedge executes →
 * reset) so it stays compelling with nothing connected.
 *
 * Chrome (wordmark, network/monitoring, wallet) comes from the (app) layout's
 * StatusRail; this component owns the readouts below it.
 */
export default function Dashboard() {
  const { view, actions } = useDashboardData();

  const degraded = view.mode === "live" && (view.stateStatus === "error" || view.eventsStatus === "error");
  const modeChip = view.mode === "demo"
    ? { label: "demo mode", tone: "default" as const }
    : degraded
      ? { label: "degraded", tone: "loss" as const }
      : { label: "live", tone: "hedge" as const };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Intro */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-3">
          <SectionLabel>Live</SectionLabel>
          <h1 className="text-balance font-display text-2xl leading-tight text-phosphor sm:text-3xl">
            Impermanent loss accrues while the pool is stale. We hedge before the arbitrageur gets there.
          </h1>
        </div>
        <Chip tone={modeChip.tone} dot={modeChip.tone !== "default"}>
          {modeChip.label}
        </Chip>
      </header>

      {/* Action / wallet status line */}
      {(actions.actionMessage || actions.walletError || actions.wrongNetwork) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded border border-rule bg-panel px-4 py-3">
          <span className="font-mono text-[11px] leading-relaxed text-ash">
            {actions.walletError || actions.actionMessage || "Wallet is on the wrong network for firing a test swap."}
          </span>
          {actions.wrongNetwork && (
            <Button variant="secondary" size="sm" onClick={actions.switchNetwork}>
              Switch to Unichain Sepolia
            </Button>
          )}
        </div>
      )}

      {/* Panels */}
      <div className="mt-6 flex flex-col gap-5">
        <PositionPanel view={view} onRetry={actions.retry} />

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <LiveTrace view={view} onRetry={actions.retry} />
          <DriftMeter view={view} onRetry={actions.retry} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <EventFeed
            view={view}
            onFireTestSwap={actions.fireTestSwap}
            canFireTestSwap={actions.canFireTestSwap}
            fireBusy={actions.fireBusy}
          />
          <BacktestStrip view={view} onRetry={actions.retry} />
        </div>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5 font-mono text-[11px] tracking-[0.04em] text-ash">
        <span>Built for UHI9 · Impermanent Loss &amp; Yield</span>
        <a
          href={config.github}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-hedge hover:underline focus-visible:text-hedge focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hedge"
        >
          Open source — fork it ↗
        </a>
        <span>Uniswap v4 · Reactive Network · Base</span>
      </footer>
    </main>
  );
}
