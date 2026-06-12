"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, formatEther, type Address, type Hex } from "viem";
import { swapRouterAbi } from "../lib/abis";
import { unichainSepolia } from "../lib/chains";
import { canSwap, chainMeta, config } from "../lib/config";
import SignalFlow, { type RaceEvent, type RaceStage } from "./SignalFlow";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type ChainKey = keyof typeof chainMeta;
type LoadStatus = "loading" | "ready" | "error";

type FeedEvent = RaceEvent & {
  id: string;
  receivedAt: number;
};

type ContractState = {
  configured: boolean;
  hook?: string;
  rsc?: string;
  executor?: string;
  poolId?: string;
  drift: number | null;
  threshold: number | null;
  hedgesFired: number | null;
  hedgeIntent: number | null;
  netHedge: number | null;
  hedgeCount: number | null;
  lastHedgeBlock?: string;
};

type ApiState = {
  configured?: boolean;
  error?: string;
  drift?: string | number;
  threshold?: string | number;
  hedgesFired?: string | number;
  hedgeIntent?: string;
  netHedge?: string;
  hedgeCount?: string | number;
  lastHedgeBlock?: string;
  addresses?: {
    hook?: string;
    rsc?: string;
    executor?: string;
    poolId?: string;
  };
};

type ApiEvent = {
  chain?: ChainKey;
  name?: string;
  detail?: string;
  tx?: string;
  block?: string;
};

type ApiEvents = {
  configured?: boolean;
  events?: ApiEvent[];
};

type BacktestRow = {
  day: number;
  price: number;
  unhedged_bps: number;
  hedged_bps: number;
};

type Backtest = {
  unhedgedBps: number;
  hedgedBps: number;
  reduction: number;
  rows: BacktestRow[];
};

type WalletState = {
  account?: Address;
  chainId?: number;
  error?: string;
};

const EMPTY_STATE: ContractState = {
  configured: false,
  drift: null,
  threshold: null,
  hedgesFired: null,
  hedgeIntent: null,
  netHedge: null,
  hedgeCount: null,
};

const LATENCY_LABEL = "~7s";

const wad = (value?: string) => {
  if (!value) return null;
  try {
    return Number(formatEther(BigInt(value)));
  } catch {
    return null;
  }
};

const numeric = (value: string | number | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const short = (value?: string) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—");

const percentFromBps = (bps: number | null) => (bps === null ? "—" : `${(bps / 100).toFixed(2)}%`);

const formatNumber = (value: number | null, dp = 0) =>
  value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));

const eventHref = (event: FeedEvent | RaceEvent) =>
  event.tx ? `${chainMeta[event.chain].explorer.replace(/\/$/, "")}/tx/${event.tx}` : undefined;

const addressHref = (chain: ChainKey, address?: string) =>
  address ? `${chainMeta[chain].explorer.replace(/\/$/, "")}/address/${address}` : undefined;

const eventStage = (events: FeedEvent[], state: ContractState, stateStatus: LoadStatus, eventsStatus: LoadStatus): RaceStage => {
  if (stateStatus === "error" || eventsStatus === "error") return "stalled";
  const latest = events[0];
  if (latest?.name === "HedgeExecuted") return "hedged";
  if (latest?.name === "Callback") return "breached";
  if (latest?.name === "SwapObserved") return "observed";
  if (state.threshold && state.drift !== null && state.drift >= state.threshold) return "breached";
  return "listening";
};

function useOdometer(value: number | null, dp = 0) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (value === null) {
      setShown(null);
      fromRef.current = null;
      return;
    }

    const from = fromRef.current ?? value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(value);
      fromRef.current = value;
      return;
    }

    const start = performance.now();
    const duration = 600;
    let raf = 0;

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(from + (value - from) * eased);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return formatNumber(shown, dp);
}

function Odometer({ value, dp = 0, suffix = "" }: { value: number | null; dp?: number; suffix?: string }) {
  return (
    <span className="odometer">
      {useOdometer(value, dp)}
      {value === null ? "" : suffix}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>;
}

function ChainDot({ chain, status }: { chain: ChainKey; status: "ok" | "degraded" | "down" }) {
  return (
    <span
      className={`chain-dot status-${status}`}
      style={{ "--role": chainMeta[chain].color } as CSSProperties}
      title={`${chainMeta[chain].name} · chain ${chainMeta[chain].id}`}
    />
  );
}

function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="skeleton-line" key={index} />
      ))}
    </div>
  );
}

function InlineError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="inline-error" role="status">
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="text-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function BacktestChart({ rows }: { rows: BacktestRow[] }) {
  if (!rows.length) {
    return (
      <div className="chart-empty">
        <strong>No backtest rows loaded</strong>
        <span>contracts/backtest/results.csv did not return data.</span>
      </div>
    );
  }

  const width = 960;
  const height = 320;
  const pad = { top: 24, right: 28, bottom: 42, left: 58 };
  const maxBps = Math.max(...rows.map((row) => Math.max(row.unhedged_bps, row.hedged_bps)), 1);
  const count = Math.max(rows.length - 1, 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (index / count) * plotW;
  const y = (bps: number) => pad.top + plotH - (bps / maxBps) * plotH;
  const line = (key: "unhedged_bps" | "hedged_bps") =>
    rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  const unprotectedLine = line("unhedged_bps");
  const protectedLine = line("hedged_bps");
  const gapPath = `${unprotectedLine} ${rows
    .slice()
    .reverse()
    .map((row, index) => {
      const originalIndex = rows.length - 1 - index;
      return `L${x(originalIndex).toFixed(1)},${y(row.hedged_bps).toFixed(1)}`;
    })
    .join(" ")} Z`;

  return (
    <figure className="backtest-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="backtest-title backtest-desc">
        <title id="backtest-title">ReactiveHedge impermanent-loss backtest</title>
        <desc id="backtest-desc">Unprotected impermanent loss versus protected impermanent loss over 30 days.</desc>
        <defs>
          <linearGradient id="proofGap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--leak)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--leak)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const ty = pad.top + plotH - tick * plotH;
          return (
            <g key={tick}>
              <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={ty} y2={ty} />
              <text className="chart-axis" x={pad.left - 14} y={ty + 4} textAnchor="end">
                {((maxBps * tick) / 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
        <path className="chart-gap" d={gapPath} />
        <path className="chart-line leak-line" d={unprotectedLine} />
        <path className="chart-line hedge-line" d={protectedLine} />
        <text className="chart-callout" x={width - pad.right - 162} y={pad.top + 42}>
          IL prevented
        </text>
        <text className="chart-axis" x={pad.left} y={height - 12}>
          day 0
        </text>
        <text className="chart-axis" x={width - pad.right} y={height - 12} textAnchor="end">
          day {rows[rows.length - 1].day}
        </text>
      </svg>
      <figcaption>
        <span className="legend leak">unprotected</span>
        <span className="legend hedge">protected</span>
        <span className="legend gap">gap = IL prevented</span>
      </figcaption>
    </figure>
  );
}

function StateCard({
  chain,
  role,
  title,
  value,
  valueSuffix,
  valueDp = 2,
  status,
  detail,
  href,
  children,
}: {
  chain: ChainKey;
  role: string;
  title: string;
  value: number | null;
  valueSuffix?: string;
  valueDp?: number;
  status: "ok" | "degraded" | "down";
  detail: string;
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="state-card" style={{ "--role": chainMeta[chain].color } as CSSProperties}>
      <div className="card-topline">
        <span>{role} · {chainMeta[chain].name}</span>
        <ChainDot chain={chain} status={status} />
      </div>
      <h3>{title}</h3>
      <div className="state-value">
        <Odometer value={value} dp={valueDp} suffix={valueSuffix} />
      </div>
      {children}
      <div className="card-foot">
        <span>{detail}</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            explorer ↗
          </a>
        ) : (
          <span>explorer unavailable</span>
        )}
      </div>
    </article>
  );
}

function DriftGauge({ drift, threshold }: { drift: number | null; threshold: number | null }) {
  const pct = threshold && drift !== null ? Math.max(0, Math.min(100, (drift / threshold) * 100)) : 0;

  return (
    <div className={`drift-gauge ${pct >= 80 ? "near-breach" : ""}`}>
      <div className="gauge-topline">
        <span>drift</span>
        <strong>{formatNumber(pct, 0)}% of threshold</strong>
      </div>
      <div className="gauge-track" aria-label={`${formatNumber(pct, 0)} percent of threshold`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="gauge-scale">
        <span>{drift === null ? "—" : `${drift} bps`}</span>
        <span>{threshold === null ? "threshold —" : `${threshold} bps`}</span>
      </div>
    </div>
  );
}

function EventLedger({
  events,
  status,
  configured,
  error,
  onRetry,
  onFireTestSwap,
  canFireTestSwap,
  fireBusy,
}: {
  events: FeedEvent[];
  status: LoadStatus;
  configured: boolean;
  error?: string;
  onRetry: () => void;
  onFireTestSwap: () => void;
  canFireTestSwap: boolean;
  fireBusy: boolean;
}) {
  const [expanded, setExpanded] = useState<string | undefined>();

  if (status === "loading") {
    return (
      <div className="ledger-frame">
        <SkeletonLines rows={6} />
      </div>
    );
  }

  if (status === "error") {
    return <InlineError title="Event stream failed" message={error || "The live event route did not respond."} onRetry={onRetry} />;
  }

  if (!configured) {
    return (
      <div className="empty-panel">
        <strong>Live testnet config required</strong>
        <span>Set HOOK_ADDRESS, RSC_ADDRESS, EXECUTOR_ADDRESS, POOL_ID, and RPC URLs to read live events.</span>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="empty-panel">
        <strong>Listening on Unichain Sepolia — no qualifying swap yet</strong>
        <span>The monitor is live. Fire a real testnet swap to drive SwapObserved → Callback → HedgeExecuted.</span>
        <button type="button" className="action-button" onClick={onFireTestSwap} disabled={!canFireTestSwap || fireBusy}>
          {fireBusy ? "Submitting real swap..." : "Fire real test swap"}
        </button>
      </div>
    );
  }

  return (
    <div className="ledger-frame" role="table" aria-label="Live cross-chain event stream">
      <div className="ledger-header" role="row">
        <span role="columnheader">received</span>
        <span role="columnheader">event</span>
        <span role="columnheader">chain</span>
        <span role="columnheader">detail</span>
        <span role="columnheader">tx</span>
      </div>
      {events.map((event) => {
        const href = eventHref(event);
        const open = expanded === event.id;

        return (
          <div className="ledger-item" key={event.id}>
            <button
              type="button"
              className="ledger-row"
              onClick={() => setExpanded(open ? undefined : event.id)}
              aria-expanded={open}
              role="row"
            >
              <span role="cell">{formatClock(event.receivedAt)}</span>
              <strong role="cell">{event.name}</strong>
              <span role="cell" className="chain-cell" style={{ "--role": chainMeta[event.chain].color } as CSSProperties}>
                <ChainDot chain={event.chain} status="ok" />
                {chainMeta[event.chain].name}
              </span>
              <span role="cell">{event.detail}</span>
              <span role="cell">{event.tx ? short(event.tx) : "no tx"}</span>
            </button>
            {open && (
              <div className="ledger-detail">
                <span>block: {event.block || "not returned"}</span>
                <span>payload: {event.detail}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    open transaction ↗
                  </a>
                ) : (
                  <span>transaction hash unavailable</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [stateStatus, setStateStatus] = useState<LoadStatus>("loading");
  const [eventsStatus, setEventsStatus] = useState<LoadStatus>("loading");
  const [backtestStatus, setBacktestStatus] = useState<LoadStatus>("loading");
  const [stateError, setStateError] = useState<string>();
  const [eventsError, setEventsError] = useState<string>();
  const [backtestError, setBacktestError] = useState<string>();
  const [snapshot, setSnapshot] = useState<ContractState>(EMPTY_STATE);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [wallet, setWallet] = useState<WalletState>({});
  const [fireBusy, setFireBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchBacktest = useCallback(async () => {
    setBacktestStatus("loading");
    setBacktestError(undefined);

    try {
      const response = await fetch("/api/backtest", { cache: "no-store" });
      const data = (await response.json()) as Backtest;
      if (!response.ok || !Array.isArray(data.rows)) {
        throw new Error("Backtest CSV did not load.");
      }
      setBacktest(data);
      setBacktestStatus("ready");
    } catch (error) {
      setBacktest(null);
      setBacktestError(error instanceof Error ? error.message : "Backtest route failed.");
      setBacktestStatus("error");
    }
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      const data = (await response.json()) as ApiState;
      if (!response.ok) throw new Error(data.error || "State route returned an error.");

      if (!data.configured) {
        setSnapshot(EMPTY_STATE);
      } else {
        setSnapshot({
          configured: true,
          hook: data.addresses?.hook || config.hook,
          rsc: data.addresses?.rsc || config.rsc,
          executor: data.addresses?.executor || config.executor,
          poolId: data.addresses?.poolId || config.poolId,
          drift: numeric(data.drift),
          threshold: numeric(data.threshold),
          hedgesFired: numeric(data.hedgesFired),
          hedgeIntent: wad(data.hedgeIntent),
          netHedge: wad(data.netHedge),
          hedgeCount: numeric(data.hedgeCount),
          lastHedgeBlock: data.lastHedgeBlock,
        });
      }

      setStateStatus("ready");
      setStateError(undefined);
    } catch (error) {
      setStateStatus("error");
      setStateError(error instanceof Error ? error.message : "State route failed.");
    }

    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      const data = (await response.json()) as ApiEvents;
      if (!response.ok) throw new Error("Event route returned an error.");

      if (!data.configured) {
        setEvents([]);
      } else {
        const receivedAt = Date.now();
        setEvents(
          (data.events || []).slice(0, 40).map((event, index) => ({
            id: `${event.tx || event.block || event.name || "event"}-${index}`,
            chain: event.chain || "origin",
            name: event.name || "UnknownEvent",
            detail: event.detail || "event received",
            tx: event.tx,
            block: event.block,
            receivedAt: receivedAt - index * 1000,
          })),
        );
      }

      setEventsStatus("ready");
      setEventsError(undefined);
    } catch (error) {
      setEventsStatus("error");
      setEventsError(error instanceof Error ? error.message : "Event route failed.");
    }
  }, []);

  useEffect(() => {
    fetchBacktest();
  }, [fetchBacktest]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      await fetchLive();
    };

    poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [fetchLive, refreshNonce]);

  const retry = useCallback(() => {
    setRefreshNonce((value) => value + 1);
    fetchBacktest();
  }, [fetchBacktest]);

  const latest = useMemo(
    () => ({
      swap: events.find((event) => event.name === "SwapObserved"),
      callback: events.find((event) => event.name === "Callback"),
      hedge: events.find((event) => event.name === "HedgeExecuted"),
    }),
    [events],
  );
  const stage = eventStage(events, snapshot, stateStatus, eventsStatus);
  const liveOk = snapshot.configured && stateStatus === "ready" && eventsStatus === "ready";
  const degraded = snapshot.configured && (stateStatus === "error" || eventsStatus === "error");
  const modeLabel = liveOk ? "LIVE" : degraded ? "DEGRADED" : "CONFIG NEEDED";
  const chainStatus = stateStatus === "error" ? "down" : degraded ? "degraded" : liveOk ? "ok" : "degraded";
  const canFireRealSwap = canSwap && Boolean(wallet.account) && wallet.chainId === unichainSepolia.id && !fireBusy;

  const connectWallet = useCallback(async () => {
    setActionMessage(undefined);
    if (!window.ethereum) {
      setWallet({ error: "No injected wallet found." });
      return;
    }

    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as Address[];
      const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
      setWallet({ account: accounts[0], chainId: Number.parseInt(chainIdHex, 16) });
    } catch (error) {
      setWallet({ error: error instanceof Error ? error.message : "Wallet request rejected." });
    }
  }, []);

  const switchToUnichain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x515" }] });
      await connectWallet();
    } catch (error) {
      setWallet((current) => ({ ...current, error: error instanceof Error ? error.message : "Network switch failed." }));
    }
  }, [connectWallet]);

  const fireTestSwap = useCallback(async () => {
    setActionMessage(undefined);

    if (!canSwap) {
      setActionMessage("Real swap config missing: set NEXT_PUBLIC_SWAP_ROUTER, pool currencies, and hook address.");
      return;
    }
    if (!window.ethereum) {
      setActionMessage("No injected wallet found. Connect a testnet wallet to fire a real swap.");
      return;
    }
    if (!wallet.account) {
      await connectWallet();
      return;
    }
    if (wallet.chainId !== unichainSepolia.id) {
      setActionMessage("Switch to Unichain Sepolia before firing the real test swap.");
      return;
    }

    setFireBusy(true);
    try {
      const walletClient = createWalletClient({ chain: unichainSepolia, transport: custom(window.ethereum) });
      const key = {
        currency0: config.currency0!,
        currency1: config.currency1!,
        fee: 3000,
        tickSpacing: 60,
        hooks: config.hook!,
      };
      const params = {
        zeroForOne: true,
        amountSpecified: -1_000_000_000_000_000n,
        sqrtPriceLimitX96: 4295128740n,
      };

      await walletClient.writeContract({
        account: wallet.account,
        address: config.currency0!,
        abi: swapRouterAbi,
        functionName: "approve",
        args: [config.swapRouter!, 2n ** 255n],
      });

      const tx = await walletClient.writeContract({
        account: wallet.account,
        address: config.swapRouter!,
        abi: swapRouterAbi,
        functionName: "swap",
        args: [key, params, { takeClaims: false, settleUsingBurn: false }, "0x"],
      });

      setActionMessage(`Real swap submitted ${short(tx)}. Waiting for /api/events to show SwapObserved.`);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Transaction rejected.");
    } finally {
      setFireBusy(false);
    }
  }, [connectWallet, wallet.account, wallet.chainId]);

  const lastSwap = latest.swap ? `SwapObserved block ${latest.swap.block || "unknown"}` : "no recent SwapObserved";
  const lastHedge = latest.hedge ? `HedgeExecuted block ${latest.hedge.block || "unknown"}` : "no recent HedgeExecuted";
  const proof = backtest
    ? {
        unhedged: backtest.unhedgedBps,
        hedged: backtest.hedgedBps,
        reduction: backtest.reduction,
      }
    : { unhedged: null, hedged: null, reduction: null };

  return (
    <main className="instrument-shell">
      <header className="masthead">
        <a className="wordmark" href="#live" aria-label="ReactiveHedge live monitor">
          ReactiveHedge
        </a>
        <div className="chain-health" aria-label="Live chain health">
          <span>
            Unichain Sepolia <ChainDot chain="origin" status={chainStatus} />
          </span>
          <span>
            Reactive Lasna <ChainDot chain="reactive" status={chainStatus} />
          </span>
          <span>
            Base Sepolia <ChainDot chain="dest" status={chainStatus} />
          </span>
        </div>
        <div className="masthead-actions">
          <span className={`live-pill ${liveOk ? "ok" : degraded ? "degraded" : "offline"}`}>● {modeLabel}</span>
          <a className="chrome-link" href={config.github} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <button className="chrome-link" type="button" onClick={connectWallet}>
            {wallet.account ? short(wallet.account) : "Connect"}
          </button>
        </div>
      </header>

      {wallet.chainId && wallet.chainId !== unichainSepolia.id && (
        <div className="status-banner" role="status">
          <span>Wallet is on chain {wallet.chainId}. Fire test swap requires Unichain Sepolia.</span>
          <button type="button" className="text-button" onClick={switchToUnichain}>
            Switch network
          </button>
        </div>
      )}
      {wallet.error && (
        <div className="status-banner error" role="status">
          <span>{wallet.error}</span>
        </div>
      )}

      <section className="live-section" id="live">
        <SectionLabel>LIVE</SectionLabel>
        <h1 className="thesis">Impermanent loss happens while the pool is stale. We hedge before the arbitrageur gets there.</h1>
        <div className="live-grid">
          <SignalFlow
            stage={stage}
            configured={snapshot.configured}
            drift={snapshot.drift}
            threshold={snapshot.threshold}
            hedgeIntent={snapshot.hedgeIntent}
            netHedge={snapshot.netHedge}
            latest={latest}
            onFireTestSwap={fireTestSwap}
            canFireTestSwap={canFireRealSwap}
            fireBusy={fireBusy}
            actionMessage={actionMessage}
          />
          <aside className="proof-card" aria-label="Backtest proof">
            {backtestStatus === "loading" ? (
              <SkeletonLines rows={4} />
            ) : backtestStatus === "error" ? (
              <InlineError title="Backtest unavailable" message={backtestError || "CSV read failed."} onRetry={fetchBacktest} />
            ) : (
              <>
                <span>30-day ETH/USDC backtest</span>
                <div className="proof-figure">
                  <span className="leak-text">{percentFromBps(proof.unhedged)}</span>
                  <span>→</span>
                  <span className="hedge-text">{percentFromBps(proof.hedged)}</span>
                </div>
                <strong>~{formatNumber(proof.reduction)}% prevented</strong>
                <small>source: /api/backtest</small>
              </>
            )}
          </aside>
        </div>
        <nav className="quiet-nav" aria-label="Page sections">
          <a href="#state">See the contracts ↓</a>
          <a href="#mechanism">Read the mechanism ↓</a>
        </nav>
      </section>

      <section className="state-section" id="state">
        <SectionLabel>STATE</SectionLabel>
        {stateStatus === "loading" ? (
          <div className="state-grid">
            <div className="state-card"><SkeletonLines rows={5} /></div>
            <div className="state-card"><SkeletonLines rows={5} /></div>
            <div className="state-card"><SkeletonLines rows={5} /></div>
          </div>
        ) : (
          <>
            {stateStatus === "error" && (
              <InlineError title="State read failed" message={stateError || "The live state route did not respond."} onRetry={retry} />
            )}
            {!snapshot.configured && stateStatus === "ready" && (
              <div className="empty-panel">
                <strong>Live state is not configured</strong>
                <span>Set server RPCs and contract addresses. This page stays blank until live reads succeed.</span>
              </div>
            )}
            <div className="state-grid">
              <StateCard
                chain="origin"
                role="HOOK"
                title="per-LP delta"
                value={snapshot.hedgeIntent}
                valueSuffix=" ETH"
                valueDp={4}
                status={chainStatus}
                detail={lastSwap}
                href={addressHref("origin", snapshot.hook)}
              />
              <StateCard
                chain="reactive"
                role="RSC"
                title="drift"
                value={snapshot.drift}
                valueSuffix=" bps"
                valueDp={0}
                status={chainStatus}
                detail={snapshot.configured ? "armed by drift threshold" : "not configured"}
                href={addressHref("reactive", snapshot.rsc)}
              >
                <DriftGauge drift={snapshot.drift} threshold={snapshot.threshold} />
              </StateCard>
              <StateCard
                chain="dest"
                role="EXECUTOR"
                title="net hedge"
                value={snapshot.netHedge}
                valueSuffix=" ETH"
                valueDp={4}
                status={chainStatus}
                detail={lastHedge}
                href={addressHref("dest", snapshot.executor)}
              />
            </div>
          </>
        )}
      </section>

      <section className="proof-section" id="proof">
        <SectionLabel>PROOF</SectionLabel>
        <div className="section-copy">
          <h2>The same gap, drawn over thirty days.</h2>
          <p>
            Unprotected IL widens as the leak. ReactiveHedge compresses the gap as the cure, holding the protected trace
            near 0.14%.
          </p>
        </div>
        {backtestStatus === "loading" ? (
          <div className="chart-empty"><SkeletonLines rows={5} /></div>
        ) : backtestStatus === "error" ? (
          <InlineError title="Backtest unavailable" message={backtestError || "CSV read failed."} onRetry={fetchBacktest} />
        ) : (
          backtest && <BacktestChart rows={backtest.rows} />
        )}
      </section>

      <section className="ledger-section" id="ledger">
        <SectionLabel>LEDGER</SectionLabel>
        <div className="section-copy">
          <h2>Live receipts, newest first.</h2>
          <p>Rows come directly from /api/events. Expand a row for payload and explorer links.</p>
        </div>
        <EventLedger
          events={events}
          status={eventsStatus}
          configured={snapshot.configured}
          error={eventsError}
          onRetry={retry}
          onFireTestSwap={fireTestSwap}
          canFireTestSwap={canFireRealSwap}
          fireBusy={fireBusy}
        />
      </section>

      <section className="mechanism-section" id="mechanism">
        <SectionLabel>MECHANISM</SectionLabel>
        <div className="mechanism-grid">
          <div className="section-copy">
            <h2>A hook emits the fact. Reactive decides. Base applies the hedge.</h2>
            <p>
              A v4 hook can only act when the pool is touched. Reactive lets the system act when price moves elsewhere,
              which is exactly when impermanent loss starts accruing.
            </p>
            <p className="scope-note">Three live testnets · {LATENCY_LABEL} reactive latency · mock hedge on Base Sepolia.</p>
          </div>
          <ol className="mechanism-steps">
            <li style={{ "--role": chainMeta.origin.color } as CSSProperties}>
              <span>ReactiveHedgeHook</span>
              <strong>SwapObserved</strong>
              <small>Unichain Sepolia · origin</small>
            </li>
            <li style={{ "--role": chainMeta.reactive.color } as CSSProperties}>
              <span>HedgeReactiveContract</span>
              <strong>react() · threshold</strong>
              <small>Reactive Lasna · decision</small>
            </li>
            <li style={{ "--role": chainMeta.dest.color } as CSSProperties}>
              <span>HedgeExecutor</span>
              <strong>onReactiveRebalance</strong>
              <small>Base Sepolia · cure</small>
            </li>
          </ol>
        </div>
      </section>

      <footer className="footer">
        <span>Built for UHI9 · Impermanent Loss &amp; Yield</span>
        <a href={config.github} target="_blank" rel="noreferrer">
          Open source — fork it ↗
        </a>
        <span>Uniswap v4 · Reactive Network · Base</span>
      </footer>
    </main>
  );
}
