import { cn } from "./cn";

type Tone = "default" | "hedge" | "drift" | "loss";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Optional sub-line under the value. */
  caption?: React.ReactNode;
  /** Colors the value — mint (protected), amber (at-risk), coral (true loss). */
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}

const toneClass: Record<Tone, string> = {
  default: "text-phosphor",
  hedge: "text-hedge",
  drift: "text-drift",
  loss: "text-loss",
};

const valueSize = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

/** Label (Ash) over a mono value (the readout). All numbers render in mono. */
export function Stat({ label, value, caption, tone = "default", size = "md", className, ...props }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">{label}</span>
      <span className={cn("font-mono leading-none tabular-nums", valueSize[size], toneClass[tone])}>
        {value}
      </span>
      {caption && <span className="font-mono text-[11px] tracking-[0.04em] text-ash">{caption}</span>}
    </div>
  );
}
