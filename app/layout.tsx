import type { Metadata } from "next";
import { Familjen_Grotesk, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Instrument-panel type roles:
//   display — big readouts & headlines (tight tracking, grotesk)
//   body    — default UI text
//   mono    — every number, hash, address, chain id ("the readout")
//
// TODO(brand): the brief's display face is Hubot Sans (GitHub, OFL). Self-host via
// @fontsource-variable/hubot-sans and swap `display` below for it. Familjen Grotesk
// is the sanctioned zero-setup fallback while that's deferred.
const display = Familjen_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reactivehedge.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ReactiveHedge — cross-chain impermanent-loss protection",
    template: "%s · ReactiveHedge",
  },
  description:
    "Automatic, cross-chain impermanent-loss protection for liquidity providers. ReactiveHedge watches price drift across chains and hedges the position before the stale pool gets drained.",
  applicationName: "ReactiveHedge",
  openGraph: {
    type: "website",
    siteName: "ReactiveHedge",
    title: "ReactiveHedge — cross-chain impermanent-loss protection",
    description:
      "A Uniswap v4 hook that hedges impermanent loss before arbitrage opens the gap — 93% less IL over a 30-day ETH/USDC backtest.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "ReactiveHedge — cross-chain impermanent-loss protection",
    description:
      "A Uniswap v4 hook that hedges impermanent loss before arbitrage opens the gap — 93% less IL over a 30-day ETH/USDC backtest.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
