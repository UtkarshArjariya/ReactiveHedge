"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Button } from "../ui";
import { cn } from "../ui/cn";
import { ChainDot, EmptyState, InlineError, SectionLabel, SkeletonLines } from "./parts";
import { clock, eventHref, eventLabel, shortTx } from "./format";
import { chainMeta, type DashboardView, type FeedEvent } from "./useDashboardData";

/**
 * EVENT FEED — the mono, log-style cross-chain stream:
 * swap observed → callback fired → HEDGE EXECUTED. The hedge line is the hero:
 * mint treatment and a one-shot pulse the moment it lands.
 */
export function EventFeed({
  view,
  onFireTestSwap,
  canFireTestSwap,
  fireBusy,
}: {
  view: DashboardView;
  onFireTestSwap: () => void;
  canFireTestSwap: boolean;
  fireBusy: boolean;
}) {
  const { events, eventsStatus, mode } = view;

  // Pulse the newest HedgeExecuted once, when its id first appears.
  const [pulseId, setPulseId] = useState<string>();
  const lastHeroRef = useRef<string>();
  useEffect(() => {
    const hero = events.find((e) => e.name === "HedgeExecuted");
    if (hero && hero.id !== lastHeroRef.current) {
      lastHeroRef.current = hero.id;
      setPulseId(hero.id);
      const t = window.setTimeout(() => setPulseId(undefined), 3200);
      return () => window.clearTimeout(t);
    }
  }, [events]);

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Event feed</SectionLabel>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
          {mode === "demo" ? "demo stream" : "newest first"}
        </span>
      </header>

      <div className="mt-4 grow">
        {eventsStatus === "loading" ? (
          <SkeletonLines rows={6} />
        ) : eventsStatus === "error" ? (
          <InlineError title="Event stream failed" message={view.eventsError || "The live event route did not respond."} />
        ) : events.length === 0 ? (
          <EmptyState
            title="Listening on Unichain Sepolia"
            message="The monitor is live — no qualifying swap yet. Fire a real testnet swap to drive SwapObserved → Callback → HedgeExecuted."
            action={
              <Button variant="secondary" size="sm" onClick={onFireTestSwap} disabled={!canFireTestSwap || fireBusy}>
                {fireBusy ? "Submitting swap…" : "Fire test swap"}
              </Button>
            }
          />
        ) : (
          <ol className="flex flex-col divide-y divide-rule overflow-hidden rounded border border-rule">
            {events.map((e) => (
              <EventRow key={e.id} event={e} pulse={e.id === pulseId} />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function EventRow({ event, pulse }: { event: FeedEvent; pulse: boolean }) {
  const { text, hero } = eventLabel(event.name);
  const href = eventHref(event);

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 font-mono text-[12px]",
        hero && "border-l-2 border-hedge bg-[color-mix(in_srgb,var(--hedge)_8%,transparent)]",
        hero && pulse && "motion-safe:[animation:rh-hero-pulse_1.6s_ease-out_2]",
      )}
    >
      <span className="shrink-0 tabular-nums text-ash">{clock(event.receivedAt)}</span>

      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 uppercase tracking-[0.08em]",
          hero ? "font-medium text-hedge" : "text-phosphor",
        )}
      >
        <ChainDot chain={event.chain} />
        {text}
      </span>

      <span className="hidden min-w-0 grow truncate text-ash sm:block">{event.detail}</span>

      <span className="ml-auto shrink-0 text-right text-ash sm:ml-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="tabular-nums underline-offset-2 hover:text-hedge hover:underline focus-visible:text-hedge focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hedge"
            title={`${chainMeta[event.chain].name} · ${event.tx}`}
          >
            {shortTx(event.tx)}
          </a>
        ) : (
          <span className="tabular-nums">no tx</span>
        )}
      </span>
    </li>
  );
}
