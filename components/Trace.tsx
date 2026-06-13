import { cn } from "./ui/cn";

export interface TraceProps {
  /** Loop the drift → pulse → converge animation. When false, holds `state`. */
  animate?: boolean;
  /** Static state when `animate` is false (and the conceptual end states). */
  state?: "drifting" | "converged";
  /** Height of the trace. Number is treated as px. */
  height?: number | string;
  /** Show "IL accruing" / "Protected" captions over the gap. */
  label?: boolean;
  className?: string;
  /**
   * DATA-DRIVEN MODE. When provided (0..1), the trace becomes a live readout:
   * the two chain paths spread apart by `progress` (the amber divergence gap
   * widening as drift accrues) and the gap snaps shut + turns mint when `fired`
   * flips true. Supplying this overrides `animate` / `state` (the looping CSS
   * animation is for the marketing/idle traces). Drive `progress` toward 0 as
   * you set `fired` for the converge-on-hedge snap.
   */
  progress?: number;
  /** In data-driven mode, color the paths + gap mint (hedge fired / protected). */
  fired?: boolean;
}

// Build the two cubic paths + the closed gap between them for a given half-spread
// (distance of each path from the y=100 centerline). spread≈6 → converged, ≈48 → max
// divergence. Same command structure at every spread so the geometry interpolates cleanly.
function spreadPaths(spread: number) {
  const top = (100 - spread).toFixed(1);
  const bot = (100 + spread).toFixed(1);
  return {
    a: `M0,100 C120,100 180,${top} 300,${top} C420,${top} 480,100 600,100`,
    b: `M0,100 C120,100 180,${bot} 300,${bot} C420,${bot} 480,100 600,100`,
    gap: `M0,100 C120,100 180,${top} 300,${top} C420,${top} 480,100 600,100 C480,100 420,${bot} 300,${bot} C180,${bot} 120,100 0,100 Z`,
  };
}

// Geometry lives in a fixed 600×200 user space; preserveAspectRatio="none" lets it
// fill any width while non-scaling-stroke keeps the lines a crisp 2px.
const A_DIVERGED = "M0,100 C120,100 180,52 300,52 C420,52 480,100 600,100";
const B_DIVERGED = "M0,100 C120,100 180,148 300,148 C420,148 480,100 600,100";
const GAP_DIVERGED =
  "M0,100 C120,100 180,52 300,52 C420,52 480,100 600,100 C480,100 420,148 300,148 C180,148 120,100 0,100 Z";
const A_CONVERGED = "M0,100 C150,100 250,94 300,94 C350,94 450,100 600,100";
const B_CONVERGED = "M0,100 C150,100 250,106 300,106 C350,106 450,100 600,100";
const GAP_CONVERGED =
  "M0,100 C150,100 250,94 300,94 C350,94 450,100 600,100 C450,100 350,106 300,106 C250,106 150,100 0,100 Z";

/**
 * DIVERGENCE → CONVERGENCE TRACE — the signature instrument.
 *
 * Two chain paths drift apart (amber gap = IL accruing), a mint signal pulse
 * crosses the gap, then the paths snap together and the gap turns mint
 * (protected). Two stacked SVG layers cross-fade — cheap, no path morphing.
 * All motion is GPU opacity + an offset-path pulse. Animation, static state,
 * and reduced-motion freeze-at-converged are driven from globals.css via the
 * `data-animate` / `data-state` attributes.
 */
export function Trace({
  animate = true,
  state = "drifting",
  height = 200,
  label = false,
  className,
  progress,
  fired = false,
}: TraceProps) {
  const h = typeof height === "number" ? `${height}px` : height;

  // ── Data-driven readout ────────────────────────────────────────────────────
  // The live position chart. Paths spread with drift; color + spread resolve to
  // mint when the hedge fires. Color transitions in CSS (smooth amber→mint snap);
  // the spread is driven frame-by-frame by the caller, so no path `d` transition.
  if (progress !== undefined) {
    const p = Math.max(0, Math.min(1, progress));
    const { a, b, gap } = spreadPaths(6 + p * 42);
    const signal = fired ? "var(--hedge)" : "var(--drift)";
    const stroke = fired ? "var(--hedge)" : "var(--phosphor)";
    const colorTransition = { transition: "fill 0.6s ease, stroke 0.6s ease, fill-opacity 0.6s ease" };

    return (
      <div
        className={cn("rh-trace rh-trace--data relative", className)}
        data-fired={fired ? "true" : "false"}
        style={{ height: h }}
      >
        <svg className="block h-full w-full" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden focusable="false">
          <path className="rh-trace__gap" d={gap} fill={signal} fillOpacity={fired ? 0.2 : 0.14} style={colorTransition} />
          <path className="rh-trace__path" d={a} stroke={stroke} style={colorTransition} />
          <path className="rh-trace__path" d={b} stroke={stroke} style={colorTransition} />
          {/* Signal flash at the convergence point when the hedge lands. */}
          <g className={cn("origin-center", fired && "motion-safe:[animation:rh-trace-flash_1.6s_ease-out]")} opacity={fired ? 1 : 0} style={{ transition: "opacity 0.5s ease" }}>
            <circle cx={300} cy={100} r={11} fill="var(--hedge)" fillOpacity={0.22} />
            <circle cx={300} cy={100} r={3.5} fill="var(--hedge)" />
          </g>
        </svg>
        {label && (
          <span
            className={cn(
              "pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 select-none font-mono text-[10px] uppercase tracking-[0.14em]",
              fired ? "text-hedge" : "text-drift",
            )}
            style={{ transition: "color 0.6s ease" }}
          >
            {fired ? "Protected" : "IL accruing"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("rh-trace relative", className)}
      data-animate={animate ? "true" : "false"}
      data-state={state}
      style={{ height: h }}
    >
      <svg
        className="block h-full w-full"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        {/* Diverged: spread paths + amber gap */}
        <g className="rh-trace__layer rh-trace__layer--diverged">
          <path className="rh-trace__gap" d={GAP_DIVERGED} fill="var(--drift)" fillOpacity={0.16} />
          <path className="rh-trace__path rh-trace__path--quiet" d={A_DIVERGED} stroke="var(--phosphor)" />
          <path className="rh-trace__path rh-trace__path--quiet" d={B_DIVERGED} stroke="var(--phosphor)" />
        </g>

        {/* Converged: paths together + mint gap */}
        <g className="rh-trace__layer rh-trace__layer--converged">
          <path className="rh-trace__gap" d={GAP_CONVERGED} fill="var(--hedge)" fillOpacity={0.16} />
          <path className="rh-trace__path" d={A_CONVERGED} stroke="var(--hedge)" />
          <path className="rh-trace__path" d={B_CONVERGED} stroke="var(--hedge)" />
        </g>

        {/* Signal pulse — rides the gap centerline via offset-path */}
        <g className="rh-trace__pulse [filter:drop-shadow(0_0_5px_var(--hedge))]">
          <circle r={12} fill="var(--hedge)" fillOpacity={0.25} />
          <circle r={4} fill="var(--hedge)" />
        </g>
      </svg>

      {label && (
        <>
          <span
            className={cn(
              "rh-trace__layer rh-trace__layer--diverged pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 select-none",
              "font-mono text-[10px] uppercase tracking-[0.14em] text-drift",
            )}
          >
            IL accruing
          </span>
          <span
            className={cn(
              "rh-trace__layer rh-trace__layer--converged pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none",
              "font-mono text-[10px] uppercase tracking-[0.14em] text-hedge",
            )}
          >
            Protected
          </span>
        </>
      )}
    </div>
  );
}

export default Trace;
