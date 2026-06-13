import { forwardRef } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded font-mono uppercase tracking-[0.08em] " +
  "select-none transition-[color,background-color,border-color,transform] duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-ink active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[11px]",
  md: "min-h-10 px-4 text-xs",
};

const variants: Record<Variant, string> = {
  // Mint fill on Ink — the protected/primary action.
  primary: "bg-hedge text-ink hover:brightness-110",
  // Rule outline — quiet secondary action.
  secondary:
    "border border-rule bg-transparent text-phosphor hover:border-hedge hover:text-hedge",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
});
