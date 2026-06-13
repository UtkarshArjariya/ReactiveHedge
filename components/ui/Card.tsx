import { cn } from "./cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Slightly inset, lower-contrast surface for nested tiles. */
  inset?: boolean;
}

/** Panel surface — raised card on the Ink page. Squared instrumentation (4px). */
export function Card({ inset = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded border border-rule",
        // Ink is darker than Panel, so an inset tile reads as recessed.
        inset ? "bg-ink" : "bg-panel",
        className,
      )}
      {...props}
    />
  );
}

/** Alias — same surface, named for layout intent. */
export const Panel = Card;
