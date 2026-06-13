import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

/**
 * The live dashboard, served at /app. Data wiring to /api/{state,events,backtest}
 * lives inside Dashboard and is unchanged by the move. Chrome (StatusRail) comes
 * from the (app) route-group layout.
 */
export const metadata: Metadata = {
  title: "Live monitor",
  description:
    "Watch a cross-chain hedge fire in real time: drift accrues on the stale pool, the threshold breaches, and the hedge executes on Base — with the 30-day backtest readout.",
  openGraph: { title: "ReactiveHedge — live monitor" },
  twitter: { title: "ReactiveHedge — live monitor" },
};

export default function AppPage() {
  return <Dashboard />;
}
