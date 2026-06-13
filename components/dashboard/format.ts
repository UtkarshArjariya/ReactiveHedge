import { chainMeta, type FeedEvent } from "./useDashboardData";

export const fmtUsd = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtPct = (bps: number | null, dp = 2) => (bps === null ? "—" : `${(bps / 100).toFixed(dp)}%`);

export const fmtNum = (v: number | null, dp = 0) =>
  v === null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtEth = (v: number | null, dp = 4) => (v === null ? "—" : `${v.toFixed(dp)} ETH`);

export const shortTx = (v?: string) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "—");

export const eventHref = (e: FeedEvent) =>
  e.tx ? `${chainMeta[e.chain].explorer.replace(/\/$/, "")}/tx/${e.tx}` : undefined;

export const clock = (ts: number) =>
  new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(
    new Date(ts),
  );

/** Friendly display name + intent for each raw event name. */
export const eventLabel = (name: string): { text: string; hero: boolean } => {
  switch (name) {
    case "SwapObserved":
      return { text: "swap observed", hero: false };
    case "Callback":
      return { text: "callback fired", hero: false };
    case "HedgeExecuted":
      return { text: "HEDGE EXECUTED", hero: true };
    default:
      return { text: name.toLowerCase(), hero: false };
  }
};
