import type { Config } from "tailwindcss";

/**
 * ReactiveHedge — instrument-panel design system.
 * Colors map to CSS custom properties declared in app/globals.css (:root) so
 * there is a single source of truth. The two brand voices — drift (amber, the
 * at-risk problem) and hedge (mint, the protected resolution) — are used
 * sparingly and meaningfully; everything else is ink/panel/rule/ash/phosphor.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        panel: "var(--panel)",
        rule: "var(--rule)",
        ash: "var(--ash)",
        phosphor: "var(--phosphor)",
        drift: "var(--drift)",
        hedge: "var(--hedge)",
        loss: "var(--loss)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Familjen Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Instrumentation reads as squared-off: cap radius at 4px (pills stay full).
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
        xl: "4px",
        full: "9999px",
      },
      fontSize: {
        // Type scale — display sizes carry tight tracking (set per-utility below).
        "display-1": ["clamp(2.75rem, 6vw, 4.5rem)", { lineHeight: "1.0", letterSpacing: "-0.02em" }],
        "display-2": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.04", letterSpacing: "-0.015em" }],
        "display-3": ["clamp(1.5rem, 2.6vw, 2rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "caption": ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.12em" }],
      },
    },
  },
  plugins: [],
};

export default config;
