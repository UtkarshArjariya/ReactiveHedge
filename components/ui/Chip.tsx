import { cn } from "./cn";

type Tone = "default" | "hedge" | "drift" | "loss";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Show a leading status dot (pulses in the chip's tone). */
  dot?: boolean;
}

const toneText: Record<Tone, string> = {
  default: "text-ash",
  hedge: "text-hedge",
  drift: "text-drift",
  loss: "text-loss",
};

const toneDot: Record<Tone, string> = {
  default: "bg-ash",
  hedge: "bg-hedge",
  drift: "bg-drift",
  loss: "bg-loss",
};

/** Mono status chip for the readout rail — chain ids, network, live state. */
export function Chip({ tone = "default", dot = false, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded border border-rule px-2.5 py-1",
        "font-mono text-[11px] tracking-[0.1em] tabular-nums",
        toneText[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
          <span
            className={cn(
              "absolute inset-0 rounded-full motion-safe:animate-ping",
              toneDot[tone],
            )}
            aria-hidden
          />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", toneDot[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
