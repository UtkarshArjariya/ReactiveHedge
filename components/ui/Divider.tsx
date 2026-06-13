import { cn } from "./cn";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

/** Hairline rule in the Rule token — low contrast on Ink. */
export function Divider({ orientation = "horizontal", className, ...props }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "border-rule",
        orientation === "horizontal" ? "w-full border-t" : "h-full border-l",
        className,
      )}
      {...props}
    />
  );
}
