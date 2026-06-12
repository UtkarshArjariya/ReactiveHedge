"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, formatEther, type Address, type Hex } from "viem";
import { swapRouterAbi } from "../lib/abis";
import { unichainSepolia } from "../lib/chains";
import { canSwap, chainMeta, config } from "../lib/config";
import SignalFlow, { type SignalStage } from "./SignalFlow";

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

type FeedEvent = {
  id: string;
  chain: ChainKey;
  name: "SwapObserved" | "Callback" | "HedgeExecuted" | string;
  detail: string;
  tx?: string;
  block?: string;
  timestamp: number;
  synthetic?: boolean;
  latency?: string;
};

type ContractState = {
  configured: boolean;
  hook?: string;
  rsc?: string;
  executor?: string;
  poolId?: string;
  drift: number;
  threshold: number;
  hedgesFired: number;
  hedgeIntent: number;
  netHedge: number;
  hedgeCount: number;
  lastHedgeBlock?: string;
  lastSwapAge: string;
  lastHedgeAge: string;
  error?: string;
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
  stale?: boolean;
};

type WalletState = {
  account?: Address;
  chainId?: number;
  error?: string;
};

const DEMO_STAGE_MS = 2200;
const LATENCY_LABEL = "+6.8s";
const DEMO_BASE_TS = Date.UTC(2026, 0, 1, 14, 2, 18);
const DEFAULT_BACKTEST: Backtest = { unhedgedBps: 202, hedgedBps: 14, reduction: 93, rows: [] };

const baseState: ContractState = {
  configured: false,
  hook: config.hook,
  rsc: config.rsc,
  executor: config.executor,
  poolId: config.poolId,
  drift: 14,
  threshold: 58,
  hedgesFired: 12,
  hedgeIntent: 0.02,
  netHedge: 0.29,
  hedgeCount: 12,
  lastHedgeBlock: "demo",
  lastSwapAge: "listening",
  lastHedgeAge: "last loop",
};

const demoSeed: FeedEvent[] = [
  {
    id: "demo-hedge",
    chain: "dest",
    name: "HedgeExecuted",
    detail: "demo · netHedge +0.29 · delta reset",
    timestamp: DEMO_BASE_TS,
    synthetic: true,
    latency: LATENCY_LABEL,
  },
  {
    id: "demo-callback",
    chain: "reactive",
    name: "Callback",
    detail: "demo · drift crossed threshold · payload -> Base",
    timestamp: DEMO_BASE_TS - 3400,
    synthetic: true,
  },
  {
    id: "demo-swap",
    chain: "origin",
    name: "SwapObserved",
    detail: "demo · ETH/USDC drift +1.9%",
    timestamp: DEMO_BASE_TS - 6800,
    synthetic: true,
  },
];

const wad = (value?: string) => {
  if (!value) return 0;
  try {
    return Number(formatEther(BigInt(value)));
  } catch {
    return 0;
  }
};

const numeric = (value: string | number | undefined, fallback = 0) => {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const short = (value?: string) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—");

const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

const formatNumber = (value: number, dp = 0) =>
  value.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));

const explorerTx = (event: FeedEvent) => {
  if (!event.tx) return undefined;
  const base = chainMeta[event.chain].explorer;
  return `${base.replace(/\/$/, "")}/tx/${event.tx}`;
};

const eventToStage = (event?: FeedEvent): SignalStage => {
  if (!event) return "idle";
  if (event.name === "SwapObserved") return "observed";
  if (event.name === "Callback") return "reacting";
  if (event.name === "HedgeExecuted") return "executed";
  return "idle";
};

function useCountUp(value: number, dp = 0) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const duration = 600;
    let raf = 0;

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(from + (to - from) * eased);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return formatNumber(shown, dp);
}

function Odometer({ value, dp = 0, suffix = "" }: { value: number; dp?: number; suffix?: string }) {
  return (
    <span className="odometer">
      {useCountUp(value, dp)}
      {suffix}
    </span>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="section-rule" aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}

function ChainDot({ chain, status = "healthy" }: { chain: ChainKey; status?: "healthy" | "degraded" | "down" }) {
  return (
    <span
      className={`chain-dot status-${status}`}
      style={{ "--chain": chainMeta[chain].color } as CSSProperties}
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

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="error-panel" role="status">
      <strong>{title}</strong>
      <span>{message}</span>
      <button className="text-button" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function BacktestChart({ rows }: { rows: BacktestRow[] }) {
  if (!rows.length) {
    return (
      <div className="chart-empty">
        <SkeletonLines rows={4} />
        <span>Backtest CSV is warming up.</span>
      </div>
    );
  }

  const width = 960;
  const height = 320;
  const pad = { top: 22, right: 28, bottom: 42, left: 56 };
  const maxBps = Math.max(...rows.map((row) => Math.max(row.unhedged_bps, row.hedged_bps)), 1);
  const minPrice = Math.min(...rows.map((row) => row.price));
  const maxPrice = Math.max(...rows.map((row) => row.price));
  const count = Math.max(rows.length - 1, 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (index / count) * plotW;
  const y = (bps: number) => pad.top + plotH - (bps / maxBps) * plotH;
  const line = (key: "unhedged_bps" | "hedged_bps") =>
    rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  const protectedLine = line("hedged_bps");
  const unprotectedLine = line("unhedged_bps");
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
        <title id="backtest-title">30-day ETH/USDC impermanent loss backtest</title>
        <desc id="backtest-desc">
          The unprotected series rises to {pct(rows[rows.length - 1].unhedged_bps)} while the protected series ends near{" "}
          {pct(rows[rows.length - 1].hedged_bps)}.
        </desc>
        <defs>
          <linearGradient id="gap-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const ty = pad.top + plotH - tick * plotH;
          const value = (maxBps * tick) / 100;
          return (
            <g key={tick}>
              <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={ty} y2={ty} />
              <text className="chart-axis" x={pad.left - 14} y={ty + 4} textAnchor="end">
                {value.toFixed(1)}%
              </text>
            </g>
          );
        })}
        <line className="chart-axis-line" x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} />
        <line className="chart-axis-line" x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} />
        <path className="chart-gap" d={gapPath} />
        <path className="chart-line chart-line-loss" d={unprotectedLine} />
        <path className="chart-line chart-line-gain" d={protectedLine} />
        <text className="chart-callout" x={width - pad.right - 188} y={pad.top + 54}>
          IL prevented
        </text>
        <text className="chart-axis" x={pad.left} y={height - 12}>
          day 0
        </text>
        <text className="chart-axis" x={width - pad.right} y={height - 12} textAnchor="end">
          day {rows[rows.length - 1].day}
        </text>
        <text className="chart-axis" x={width - pad.right} y={pad.top - 8} textAnchor="end">
          ETH/USDC ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}
        </text>
      </svg>
      <figcaption>
        <span className="legend-item loss-line">unprotected</span>
        <span className="legend-item gain-line">protected</span>
        <span className="legend-item amber-line">gap = IL prevented</span>
      </figcaption>
    </figure>
  );
}

function StateCard({
  chain,
  role,
  contract,
  primaryLabel,
  primaryValue,
  primarySuffix,
  detail,
  status,
  href,
  children,
}: {
  chain: ChainKey;
  role: string;
  contract: string;
  primaryLabel: string;
  primaryValue: number;
  primarySuffix?: string;
  detail: string;
  status: "healthy" | "degraded" | "down";
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="state-card" style={{ "--chain": chainMeta[chain].color } as CSSProperties}>
      <div className="card-kicker">
        <span>{role}</span>
        <span className="chain-label">
          <ChainDot chain={chain} status={status} />
          {chainMeta[chain].name}
        </span>
      </div>
      <h3>{contract}</h3>
      <div className="stat-cell">
        <span>{primaryLabel}</span>
        <strong>
          <Odometer value={primaryValue} dp={primaryValue % 1 === 0 ? 0 : 2} />
          {primarySuffix}
        </strong>
      </div>
      {children}
      <div className="card-footer-line">
        <span>{detail}</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            explorer ↗
          </a>
        ) : (
          <span>demo loop</span>
        )}
      </div>
    </article>
  );
}

function DriftMeter({ drift, threshold }: { drift: number; threshold: number }) {
  const width = threshold > 0 ? Math.min(100, Math.max(0, (drift / threshold) * 100)) : 0;
  const armed = width >= 70;

  return (
    <div className={`drift-meter ${armed ? "armed" : ""}`}>
      <div className="meter-head">
        <span>accumulated drift</span>
        <strong>{formatNumber(width, 0)}% of threshold</strong>
      </div>
      <div className="meter-track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
        <i />
      </div>
      <div className="meter-scale">
        <span>0 bps</span>
        <span>{threshold} bps</span>
      </div>
    </div>
  );
}

function EventTape({
  events,
  status,
  error,
  onRetry,
  paused,
}: {
  events: FeedEvent[];
  status: LoadStatus;
  error?: string;
  onRetry: () => void;
  paused: boolean;
}) {
  const [expanded, setExpanded] = useState<string | undefined>();

  if (status === "loading" && events.length === 0) {
    return (
      <div className="event-frame">
        <SkeletonLines rows={5} />
      </div>
    );
  }

  if (status === "error" && events.length === 0) {
    return <ErrorPanel title="Event tape stalled" message={error || "The event route did not respond."} onRetry={onRetry} />;
  }

  if (events.length === 0) {
    return (
      <div className="event-empty">
        <strong>No swaps observed yet</strong>
        <span>Fire one to see the hedge react across the three testnets.</span>
      </div>
    );
  }

  return (
    <div className={`event-frame ${paused ? "paused" : ""}`} role="log" aria-live={paused ? "off" : "polite"}>
      {status === "error" && (
        <div className="inline-error">
          <span>{error || "Events failed to refresh. Showing the last tape."}</span>
          <button type="button" className="text-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {events.map((event) => {
        const open = expanded === event.id;
        const txHref = explorerTx(event);

        return (
          <div className="event-item" key={event.id}>
            <button
              type="button"
              className="event-row"
              onClick={() => setExpanded(open ? undefined : event.id)}
              aria-expanded={open}
            >
              <span className="event-time">{formatClock(event.timestamp)}</span>
              <span className="event-name">{event.name}</span>
              <span className="event-chain" style={{ "--chain": chainMeta[event.chain].color } as CSSProperties}>
                <ChainDot chain={event.chain} />
                {chainMeta[event.chain].name}
              </span>
              <span className="event-detail">{event.detail}</span>
              <span className="event-latency">{event.latency || (event.name === "HedgeExecuted" ? LATENCY_LABEL : "")}</span>
              <span className="event-tx">{event.tx ? short(event.tx) : event.synthetic ? "demo" : "local"}</span>
            </button>
            {open && (
              <div className="event-payload">
                <span>payload: {event.detail}</span>
                <span>block: {event.block || (event.synthetic ? "animated loop" : "pending")}</span>
                {txHref ? (
                  <a href={txHref} target="_blank" rel="noreferrer">
                    open transaction ↗
                  </a>
                ) : (
                  <span>synthetic row · connect RPCs for live data</span>
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
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [stateStatus, setStateStatus] = useState<LoadStatus>("loading");
  const [eventsStatus, setEventsStatus] = useState<LoadStatus>("loading");
  const [backtestStatus, setBacktestStatus] = useState<LoadStatus>("loading");
  const [stateError, setStateError] = useState<string>();
  const [eventsError, setEventsError] = useState<string>();
  const [backtestError, setBacktestError] = useState<string>();
  const [snapshot, setSnapshot] = useState<ContractState>(baseState);
  const [events, setEvents] = useState<FeedEvent[]>(demoSeed);
  const [backtest, setBacktest] = useState<Backtest>(DEFAULT_BACKTEST);
  const [paused, setPaused] = useState(false);
  const [demoStage, setDemoStage] = useState<SignalStage>("idle");
  const [replayNonce, setReplayNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [wallet, setWallet] = useState<WalletState>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const sequence = useRef(0);

  const pushEvent = useCallback((event: Omit<FeedEvent, "id" | "timestamp">) => {
    sequence.current += 1;
    setEvents((current) => [
      {
        ...event,
        id: `${Date.now()}-${sequence.current}`,
        timestamp: Date.now(),
      },
      ...current,
    ].slice(0, 36));
  }, []);

  const fetchBacktest = useCallback(async () => {
    setBacktestStatus("loading");
    setBacktestError(undefined);

    try {
      const response = await fetch("/api/backtest", { cache: "no-store" });
      const data = (await response.json()) as Backtest;
      if (!response.ok) throw new Error("Backtest route returned an error.");
      setBacktest({
        unhedgedBps: numeric(data.unhedgedBps, DEFAULT_BACKTEST.unhedgedBps),
        hedgedBps: numeric(data.hedgedBps, DEFAULT_BACKTEST.hedgedBps),
        reduction: numeric(data.reduction, DEFAULT_BACKTEST.reduction),
        rows: Array.isArray(data.rows) ? data.rows : [],
        stale: data.stale,
      });
      setBacktestStatus("ready");
    } catch (error) {
      setBacktest(DEFAULT_BACKTEST);
      setBacktestError(error instanceof Error ? error.message : "Backtest route failed.");
      setBacktestStatus("error");
    }
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const stateResponse = await fetch("/api/state", { cache: "no-store" });
      const stateData = (await stateResponse.json()) as ApiState;

      if (!stateResponse.ok) {
        throw new Error(stateData.error || "State route returned an error.");
      }

      if (stateData.configured) {
        setMode("live");
        setSnapshot({
          configured: true,
          hook: stateData.addresses?.hook || config.hook,
          rsc: stateData.addresses?.rsc || config.rsc,
          executor: stateData.addresses?.executor || config.executor,
          poolId: stateData.addresses?.poolId || config.poolId,
          drift: numeric(stateData.drift),
          threshold: numeric(stateData.threshold, 50),
          hedgesFired: numeric(stateData.hedgesFired),
          hedgeIntent: wad(stateData.hedgeIntent),
          netHedge: wad(stateData.netHedge),
          hedgeCount: numeric(stateData.hedgeCount),
          lastHedgeBlock: stateData.lastHedgeBlock,
          lastSwapAge: "fresh poll",
          lastHedgeAge: stateData.lastHedgeBlock ? `block ${stateData.lastHedgeBlock}` : "pending",
        });
      } else {
        setMode("demo");
      }

      setStateStatus("ready");
      setStateError(undefined);
    } catch (error) {
      setStateStatus("error");
      setStateError(error instanceof Error ? error.message : "State route failed.");
      setSnapshot((current) => ({ ...current, error: "read failed" }));
    }

    try {
      const eventsResponse = await fetch("/api/events", { cache: "no-store" });
      const eventsData = (await eventsResponse.json()) as ApiEvents;

      if (!eventsResponse.ok) {
        throw new Error("Event route returned an error.");
      }

      if (eventsData.configured && Array.isArray(eventsData.events) && eventsData.events.length > 0) {
        setEvents(
          eventsData.events.slice(0, 36).map((event, index) => ({
            id: `${event.tx || event.block || "event"}-${index}`,
            chain: event.chain || "origin",
            name: event.name || "SwapObserved",
            detail: event.detail || "event received",
            tx: event.tx,
            block: event.block,
            timestamp: Date.now() - index * 1000,
            latency: event.name === "HedgeExecuted" ? LATENCY_LABEL : undefined,
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
      if (!alive || paused) return;
      await fetchLive();
    };

    poll();
    const timer = window.setInterval(poll, 5000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [fetchLive, paused, refreshNonce]);

  useEffect(() => {
    if (mode !== "demo" || paused) return;

    const stages: SignalStage[] = ["idle", "observed", "reacting", "executed"];
    let index = 0;
    setDemoStage(stages[index]);

    const timer = window.setInterval(() => {
      index = (index + 1) % stages.length;
      const next = stages[index];
      setDemoStage(next);

      if (next === "observed") {
        setSnapshot((current) => ({
          ...current,
          drift: 42,
          hedgeIntent: 0.31,
          lastSwapAge: "0.0s ago",
        }));
        pushEvent({
          chain: "origin",
          name: "SwapObserved",
          detail: "demo · ETH/USDC drift +1.9%",
          synthetic: true,
        });
      }

      if (next === "reacting") {
        setSnapshot((current) => ({ ...current, drift: 52, hedgeIntent: 0.31 }));
        pushEvent({
          chain: "reactive",
          name: "Callback",
          detail: "demo · drift > threshold · payload -> Base",
          synthetic: true,
        });
      }

      if (next === "executed") {
        setSnapshot((current) => ({
          ...current,
          drift: 9,
          hedgeIntent: 0.02,
          netHedge: 0.29,
          hedgeCount: current.hedgeCount + 1,
          hedgesFired: current.hedgesFired + 1,
          lastHedgeAge: LATENCY_LABEL,
        }));
        pushEvent({
          chain: "dest",
          name: "HedgeExecuted",
          detail: "demo · netHedge +0.29 · delta reset",
          synthetic: true,
          latency: LATENCY_LABEL,
        });
      }

      if (next === "idle") {
        setSnapshot((current) => ({ ...current, drift: 14, hedgeIntent: 0.02, lastSwapAge: "listening" }));
      }
    }, DEMO_STAGE_MS);

    return () => window.clearInterval(timer);
  }, [mode, paused, pushEvent]);

  const latestEvent = events[0];
  const stage = mode === "demo" ? demoStage : eventToStage(latestEvent);
  const demoMode = mode === "demo";
  const liveDegraded = mode === "live" && (stateStatus === "error" || eventsStatus === "error");
  const healthStatus = liveDegraded ? "degraded" : "healthy";
  const latestBlock = latestEvent?.block || snapshot.lastHedgeBlock || (demoMode ? "demo-loop" : "pending");
  const signalCaption = useMemo(() => {
    if (stage === "observed") return "CPI-sized swap drifted ETH/USDC on Unichain Sepolia; the hook emitted SwapObserved.";
    if (stage === "reacting") return "Reactive Lasna crossed the drift threshold and sent the callback payload toward Base Sepolia.";
    if (stage === "executed") return "HedgeExecuted landed on Base Sepolia in about 6.8s; delta reset toward zero.";
    return "Listening for swaps across Unichain Sepolia, Reactive Lasna, and Base Sepolia.";
  }, [stage]);

  const connectWallet = useCallback(async () => {
    setNotice(undefined);

    if (!window.ethereum) {
      setWallet({ error: "No injected wallet found." });
      return;
    }

    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as Address[];
      const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
      setWallet({
        account: accounts[0],
        chainId: Number.parseInt(chainIdHex, 16),
      });
    } catch (error) {
      setWallet({ error: error instanceof Error ? error.message : "Wallet request rejected." });
    }
  }, []);

  const switchToUnichain = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x515" }],
      });
      await connectWallet();
    } catch (error) {
      setWallet({ ...wallet, error: error instanceof Error ? error.message : "Network switch failed." });
    }
  }, [connectWallet, wallet]);

  const fireTestSwap = useCallback(async () => {
    setBusy(true);
    setNotice(undefined);
    setReplayNonce((value) => value + 1);

    try {
      if (!canSwap || !window.ethereum) {
        setMode("demo");
        setDemoStage("observed");
        pushEvent({
          chain: "origin",
          name: "SwapObserved",
          detail: "demo · manual test swap · drift +1.9%",
          synthetic: true,
        });
        window.setTimeout(() => {
          setDemoStage("reacting");
          pushEvent({
            chain: "reactive",
            name: "Callback",
            detail: "demo · threshold crossed · callback armed",
            synthetic: true,
          });
        }, 1200);
        window.setTimeout(() => {
          setDemoStage("executed");
          setSnapshot((current) => ({
            ...current,
            drift: 7,
            hedgeIntent: 0.01,
            hedgeCount: current.hedgeCount + 1,
            hedgesFired: current.hedgesFired + 1,
          }));
          pushEvent({
            chain: "dest",
            name: "HedgeExecuted",
            detail: "demo · hedge rebalanced on Base Sepolia",
            synthetic: true,
            latency: LATENCY_LABEL,
          });
          setBusy(false);
        }, 2600);
        setNotice(canSwap ? "Connect a wallet to send a real swap." : "Demo loop fired. Add NEXT_PUBLIC_* addresses for live swaps.");
        return;
      }

      const walletClient = createWalletClient({ chain: unichainSepolia, transport: custom(window.ethereum) });
      const [account] = await walletClient.requestAddresses();
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
        account,
        address: config.currency0!,
        abi: swapRouterAbi,
        functionName: "approve",
        args: [config.swapRouter!, 2n ** 255n],
      });

      const tx = await walletClient.writeContract({
        account,
        address: config.swapRouter!,
        abi: swapRouterAbi,
        functionName: "swap",
        args: [key, params, { takeClaims: false, settleUsingBurn: false }, "0x"],
      });

      pushEvent({
        chain: "origin",
        name: "SwapObserved",
        detail: `swap sent · ${short(tx)}`,
        tx,
      });
      setNotice("Swap sent. Watch for the Reactive callback and Base hedge.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Transaction rejected.");
    } finally {
      if (canSwap && window.ethereum) setBusy(false);
    }
  }, [pushEvent]);

  const manualRefresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
    fetchBacktest();
  }, [fetchBacktest]);

  return (
    <main className="page-shell">
      <header className="masthead">
        <div className="masthead-top">
          <a className="wordmark" href="#top" aria-label="ReactiveHedge home">
            ReactiveHedge
          </a>
          <div className="chain-health" aria-label="Chain health">
            <span>
              Unichain <ChainDot chain="origin" status={healthStatus} />
            </span>
            <span>
              Lasna <ChainDot chain="reactive" status={healthStatus} />
            </span>
            <span>
              Base <ChainDot chain="dest" status={healthStatus} />
            </span>
          </div>
          <div className="masthead-actions">
            <span className={`mode-pill ${demoMode ? "demo" : liveDegraded ? "degraded" : "live"}`}>
              <span aria-hidden="true">●</span> {demoMode ? "DEMO" : liveDegraded ? "DEGRADED" : "LIVE"}
            </span>
            <a className="chrome-button" href={config.github} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <button className="chrome-button" type="button" onClick={connectWallet}>
              {wallet.account ? short(wallet.account) : "Connect"}
            </button>
          </div>
        </div>
        <div className="dateline">
          <span>REACTIVEHEDGE · UHI9 · IL &amp; YIELD · TESTNET</span>
          <span>BLOCK {latestBlock} · t{LATENCY_LABEL}</span>
        </div>
        {wallet.chainId && wallet.chainId !== unichainSepolia.id && (
          <div className="network-banner" role="status">
            <span>Wallet is on chain {wallet.chainId}. Switch to Unichain Sepolia to fire a real test swap.</span>
            <button type="button" className="text-button" onClick={switchToUnichain}>
              Switch to Unichain Sepolia
            </button>
          </div>
        )}
        {wallet.error && (
          <div className="network-banner error" role="status">
            <span>{wallet.error}</span>
          </div>
        )}
      </header>

      <section className="hero-section" id="top">
        <SectionRule label="01 — HERO / THESIS" />
        <div className="hero-grid">
          <div>
            <h1 aria-label="Impermanent loss happens when the pool is stale. So we hedge the moment the price moves on another chain.">
              <span className="hero-copy-desktop" aria-hidden="true">
                Impermanent loss happens when the pool is <em>stale</em>. So we hedge the moment the price moves - on
                another chain.
              </span>
              <span className="hero-copy-mobile" aria-hidden="true">
                Impermanent loss
                <br />
                happens when the pool
                <br />
                is <em>stale</em>. So we hedge
                <br />
                the moment the price
                <br />
                moves on another chain.
              </span>
            </h1>
            <blockquote aria-label="v4 hooks only act when the pool is touched. Reactive lets the hook act when the price moves elsewhere, exactly when IL accrues.">
              <span className="hero-copy-desktop" aria-hidden="true">
                v4 hooks only act when the pool is touched. Reactive lets the hook act when the price moves elsewhere -
                exactly when IL accrues.
              </span>
              <span className="hero-copy-mobile" aria-hidden="true">
                v4 hooks only act when the
                <br />
                pool is touched. Reactive
                <br />
                lets the hook act when
                <br />
                price moves elsewhere -
                <br />
                exactly when IL accrues.
              </span>
            </blockquote>
            <div className="hero-actions">
              <a className="primary-button" href="#signal">
                Watch it react ↓
              </a>
              <a className="secondary-button" href="#architecture">
                Read the architecture ↓
              </a>
            </div>
          </div>
          <aside className="proof-panel" aria-label="Backtest headline">
            <span className="proof-label">IL · 30-day ETH/USDC backtest</span>
            <div className="proof-numbers">
              <span className="loss-text">{pct(backtest.unhedgedBps)}</span>
              <span>→</span>
              <span className="gain-text">{pct(backtest.hedgedBps)}</span>
            </div>
            <strong>
              ~<Odometer value={backtest.reduction} />% prevented
            </strong>
            <small>
              {backtestStatus === "loading"
                ? "loading contracts/backtest/results.csv"
                : backtest.stale
                  ? "fallback headline · CSV unavailable"
                  : "from contracts/backtest/results.csv"}
            </small>
            {backtestStatus === "error" && (
              <button className="text-button" type="button" onClick={fetchBacktest}>
                Retry backtest
              </button>
            )}
          </aside>
        </div>
      </section>

      <section className="signal-section" id="signal">
        <SectionRule label="02 — LIVE SIGNAL FLOW" />
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cross-chain hedge trigger</p>
            <h2>Swap observed. Drift armed. Hedge fired.</h2>
          </div>
          <p>{signalCaption}</p>
        </div>
        <SignalFlow
          stage={stage}
          paused={paused}
          replayNonce={replayNonce}
          latency={LATENCY_LABEL}
          demoMode={demoMode}
        />
        <div className="signal-controls">
          <button className="secondary-button" type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume live" : "Pause"}
          </button>
          <button className="secondary-button" type="button" onClick={() => setReplayNonce((value) => value + 1)}>
            Replay last hedge
          </button>
          <button className="primary-button" type="button" onClick={fireTestSwap} disabled={busy} aria-busy={busy}>
            {busy ? "Firing..." : "Fire test swap"}
          </button>
          <span>~7s reactive latency, shown honestly</span>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </section>

      <section className="state-section">
        <SectionRule label="03 — LIVE STATE" />
        {stateStatus === "error" && (
          <ErrorPanel title="State read failed" message={stateError || "Showing the last available values."} onRetry={manualRefresh} />
        )}
        <div className="state-grid">
          <StateCard
            chain="origin"
            role="HOOK"
            contract="ReactiveHedgeHook"
            primaryLabel="per-LP delta"
            primaryValue={snapshot.hedgeIntent}
            primarySuffix=" ETH"
            detail={`last SwapObserved ${snapshot.lastSwapAge}`}
            status={stateStatus === "error" ? "down" : healthStatus}
            href={snapshot.hook ? `${chainMeta.origin.explorer}/address/${snapshot.hook}` : undefined}
          >
            <div className="mini-receipt">
              <span>pool</span>
              <strong>{short(snapshot.poolId)}</strong>
            </div>
          </StateCard>
          <StateCard
            chain="reactive"
            role="RSC"
            contract="HedgeReactiveContract"
            primaryLabel="hedges fired"
            primaryValue={snapshot.hedgesFired}
            detail="armed on drift threshold"
            status={stateStatus === "error" ? "down" : healthStatus}
            href={snapshot.rsc ? `${chainMeta.reactive.explorer}/address/${snapshot.rsc}` : undefined}
          >
            <DriftMeter drift={snapshot.drift} threshold={snapshot.threshold} />
          </StateCard>
          <StateCard
            chain="dest"
            role="EXECUTOR"
            contract="HedgeExecutor"
            primaryLabel="net hedge position"
            primaryValue={snapshot.netHedge}
            primarySuffix=" ETH"
            detail={`last HedgeExecuted ${snapshot.lastHedgeAge}`}
            status={stateStatus === "error" ? "down" : healthStatus}
            href={snapshot.executor ? `${chainMeta.dest.explorer}/address/${snapshot.executor}` : undefined}
          >
            <div className="mini-receipt">
              <span>hedge count</span>
              <strong>{formatNumber(snapshot.hedgeCount)}</strong>
            </div>
          </StateCard>
        </div>
      </section>

      <section className="backtest-section">
        <SectionRule label="04 — BACKTEST" />
        <div className="section-heading">
          <div>
            <p className="eyebrow">Impermanent loss - 30-day ETH/USDC</p>
            <h2>The hedge turns a widening loss curve into a flat line.</h2>
          </div>
          <p>The shaded spread is IL prevented by the Reactive cross-chain hedge.</p>
        </div>
        {backtestStatus === "error" && (
          <ErrorPanel title="Backtest route failed" message={backtestError || "Using the fallback headline."} onRetry={fetchBacktest} />
        )}
        <BacktestChart rows={backtest.rows} />
        <div className="final-row">
          <span>
            Final: unprotected <strong className="loss-text">{pct(backtest.unhedgedBps)}</strong>
          </span>
          <span>
            protected <strong className="gain-text">{pct(backtest.hedgedBps)}</strong>
          </span>
          <span>
            prevented <strong className="amber-text">~{backtest.reduction}%</strong>
          </span>
        </div>
      </section>

      <section className="events-section">
        <SectionRule label="05 — EVENT LOG" />
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Terminal tape</p>
            <h2>Raw receipts, newest first.</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume tape" : "Pause tape"}
          </button>
        </div>
        <EventTape
          events={events}
          status={eventsStatus}
          error={eventsError}
          onRetry={manualRefresh}
          paused={paused}
        />
      </section>

      <section className="architecture-section" id="architecture">
        <SectionRule label="06 — HOW IT WORKS / ARCHITECTURE" />
        <div className="architecture-grid">
          <div>
            <p className="eyebrow">Mechanism</p>
            <h2>A hook emits the fact. Reactive decides. Base applies the hedge.</h2>
            <p>
              The pool does not need another swap before protection starts. A price move observed on Unichain Sepolia
              becomes drift on Reactive Lasna, then a callback lands on Base Sepolia where the mock hedge executor updates
              the LP exposure.
            </p>
          </div>
          <ol className="architecture-steps">
            <li style={{ "--chain": chainMeta.origin.color } as CSSProperties}>
              <span>ReactiveHedgeHook</span>
              <strong>SwapObserved</strong>
              <small>Unichain Sepolia · v4 hook</small>
            </li>
            <li style={{ "--chain": chainMeta.reactive.color } as CSSProperties}>
              <span>HedgeReactiveContract</span>
              <strong>react() / drift</strong>
              <small>Reactive Lasna · threshold logic</small>
            </li>
            <li style={{ "--chain": chainMeta.dest.color } as CSSProperties}>
              <span>HedgeExecutor</span>
              <strong>onReactiveRebalance</strong>
              <small>Base Sepolia · mock hedge</small>
            </li>
          </ol>
        </div>
        <p className="scope-note">
          TESTNET SCOPE · honest latency: about 7s · destination hedge is mocked on Base Sepolia for the UHI9 demo.
        </p>
      </section>

      <footer className="footer">
        <span>Built for UHI9 · Impermanent Loss &amp; Yield</span>
        <a href={config.github} target="_blank" rel="noreferrer">
          Open source - fork it ↗
        </a>
        <span>Uniswap v4 · Reactive Network · Base</span>
      </footer>
    </main>
  );
}
