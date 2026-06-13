"use client";

import { type CSSProperties } from "react";
import { cn } from "../ui/cn";
import { Button } from "../ui";
import { chainMeta, type ChainKey } from "./useDashboardData";

/** Section eyebrow — mono, ash, tracked-out. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.16em] text-ash", className)}>{children}</span>
  );
}

/** A small colored chain dot keyed to the chain's signal color. */
export function ChainDot({ chain, className }: { chain: ChainKey; className?: string }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", className)}
      style={{ background: chainMeta[chain].color } as CSSProperties}
      aria-hidden
    />
  );
}

/** Skeleton placeholder lines. Pulse animates element opacity (no token opacity modifiers). */
export function SkeletonLines({ rows = 3, className }: { rows?: number; className?: string }) {
  const widths = ["72%", "94%", "61%", "85%", "78%", "52%"];
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          className="block h-3 rounded-sm bg-rule motion-safe:animate-pulse"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/** Recessed readout tiles separated by hairlines — the instrument-panel motif. */
export function TileGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded border border-rule bg-rule", className)}>{children}</div>
  );
}

export function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-ink p-4", className)}>{children}</div>;
}

export function InlineError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded border border-loss bg-ink p-4" role="status">
      <div className="flex flex-col gap-1">
        <strong className="font-mono text-[12px] uppercase tracking-[0.1em] text-loss">{title}</strong>
        <span className="font-mono text-[11px] leading-relaxed text-ash">{message}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded border border-rule bg-ink p-5">
      <strong className="font-mono text-[12px] uppercase tracking-[0.1em] text-phosphor">{title}</strong>
      <span className="max-w-prose font-mono text-[11px] leading-relaxed text-ash">{message}</span>
      {action}
    </div>
  );
}
