import { cn } from "./cn";

/**
 * TRACE GLYPH — the logo mark, derived from the signature Trace motif: two
 * chain paths that start together, diverge (the gap where IL accrues), then
 * converge again. Mint, squared to the instrument-panel palette. Decorative by
 * default (aria-hidden); pass `title` to expose it as a labelled image.
 */
export function TraceGlyph({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {/* Reference path (quiet) — diverges low, converges back. */}
      <path
        d="M2 12C7 12 10 20 18 20C26 20 29 12 34 12"
        stroke="var(--hedge)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Pool path — diverges high, converges back. */}
      <path
        d="M2 12C7 12 10 4 18 4C26 4 29 12 34 12"
        stroke="var(--hedge)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Convergence node — the signal landing. */}
      <circle cx="18" cy="12" r="1.7" fill="var(--hedge)" />
    </svg>
  );
}

/**
 * Wordmark — the glyph + "ReactiveHedge" lockup used in the top rail. Renders
 * inline (no link); wrap in an <a> at the call site. The "Hedge" half carries
 * the mint accent — the protected resolution the product delivers.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <TraceGlyph className="h-4 w-6 shrink-0" />
      <span className="font-display text-base font-semibold tracking-[-0.01em] text-phosphor">
        Reactive<span className="text-hedge">Hedge</span>
      </span>
    </span>
  );
}
