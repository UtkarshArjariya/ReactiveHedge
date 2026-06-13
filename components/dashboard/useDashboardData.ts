"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, formatEther, type Address, type Hex } from "viem";
import { swapRouterAbi } from "../../lib/abis";
import { unichainSepolia } from "../../lib/chains";
import { canSwap, chainMeta, config } from "../../lib/config";

// ── Shared types ──────────────────────────────────────────────────────────────
export type ChainKey = keyof typeof chainMeta;
export type LoadStatus = "loading" | "ready" | "error";
export type Stage = "listening" | "observed" | "breached" | "hedged" | "stalled";

export type FeedEvent = {
  id: string;
  chain: ChainKey;
  name: string; // "SwapObserved" | "Callback" | "HedgeExecuted"
  detail: string;
  tx?: string;
  block?: string;
  receivedAt: number;
};

export type BacktestRow = { day: number; price: number; unhedged_bps: number; hedged_bps: number };
export type Backtest = { unhedgedBps: number; hedgedBps: number; reduction: number; rows: BacktestRow[] };

/** Everything a panel needs, unified across live + demo so the UI is source-agnostic. */
export type DashboardView = {
  mode: "live" | "demo";
  stateStatus: LoadStatus;
  eventsStatus: LoadStatus;
  backtestStatus: LoadStatus;

  // position
  positionValue: number | null; // USD notional
  positionEth: number | null; // ETH leg (display)
  ilBps: number | null; // current impermanent loss
  hedgesFired: number | null;
  netHedge: number | null; // ETH

  // signal
  driftBps: number | null;
  thresholdBps: number | null;
  driftRatio: number; // 0..1 (clamped for the meter)
  crossed: boolean; // ratio has reached / passed threshold
  fired: boolean; // hedge active / just landed → trace mint + feed hero pulse
  stage: Stage;
  protectionTone: "hedge" | "drift";
  protectionLabel: string;

  // feed + proof
  events: FeedEvent[];
  backtest: Backtest | null;

  stateError?: string;
  eventsError?: string;
  backtestError?: string;
};

export type DashboardActions = {
  retry: () => void;
  fireTestSwap: () => void;
  switchNetwork: () => void;
  canFireTestSwap: boolean;
  fireBusy: boolean;
  actionMessage?: string;
  walletError?: string;
  wrongNetwork: boolean;
};

// ── Narrative constants ───────────────────────────────────────────────────────
// The protection mechanics (drift, threshold, callbacks, hedges) are read live;
// the LP position framing around them is a representative ETH/USDC notional so the
// panel reads as a position dashboard. IL is derived from live drift vs threshold.
const BASE_NOTIONAL = 50_000; // USD — representative ETH/USDC LP position
const IL_PEAK_BPS = 202; // 2.02% — unhedged tail, matches the 30-day backtest
const IL_HEDGED_BPS = 14; // 0.14% — protected floor, matches the backtest

// Demo cadence (ms). One full watch → detect → hedge → reset cycle.
const T_SWAP = [1400, 3600, 5600];
const T_BUILD_END = 7000; // drift reaches threshold → callback
const T_HEDGE = 8300; // hedge executes on Base
const T_DRAIN_END = 9800; // drift cleared post-hedge
const T_CYCLE = 13000;
const DEMO_BLOCK_SEED = 12_840_517;

// ── API payload shapes (we consume; never rewrite the routes) ─────────────────
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
  addresses?: { hook?: string; rsc?: string; executor?: string; poolId?: string };
};
type ApiEvents = { configured?: boolean; events?: Array<{ chain?: ChainKey; name?: string; detail?: string; tx?: string; block?: string }> };

type LiveSnapshot = {
  configured: boolean;
  drift: number | null;
  threshold: number | null;
  hedgesFired: number | null;
  netHedge: number | null;
  hedgeIntent: number | null;
};

const EMPTY_SNAPSHOT: LiveSnapshot = {
  configured: false,
  drift: null,
  threshold: null,
  hedgesFired: null,
  netHedge: null,
  hedgeIntent: null,
};

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
const short = (value?: string) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—");

const liveStage = (events: FeedEvent[], snap: LiveSnapshot): Stage => {
  const latest = events[0];
  if (latest?.name === "HedgeExecuted") return "hedged";
  if (latest?.name === "Callback") return "breached";
  if (latest?.name === "SwapObserved") return "observed";
  if (snap.threshold && snap.drift !== null && snap.drift >= snap.threshold) return "breached";
  return "listening";
};

// ── Demo simulation helpers ───────────────────────────────────────────────────
type DemoSnap = {
  ratio: number;
  fired: boolean;
  stage: Stage;
  ilBps: number;
  hedgesFired: number;
  netHedge: number;
  events: FeedEvent[];
};

const demoRatio = (t: number): number => {
  if (t <= T_BUILD_END) return t / T_BUILD_END;
  if (t <= T_HEDGE) return 1;
  if (t <= T_DRAIN_END) return 1 - (t - T_HEDGE) / (T_DRAIN_END - T_HEDGE);
  return 0;
};
const demoStage = (t: number): Stage => {
  if (t >= T_HEDGE) return "hedged";
  if (t >= T_BUILD_END) return "breached";
  if (t >= T_SWAP[0]) return "observed";
  return "listening";
};

/**
 * Unified dashboard data source.
 * - LIVE: polls /api/state + /api/events every 5s, /api/backtest once.
 * - DEMO: when /api/state reports a blank env (`configured:false`), runs a
 *   self-contained watch→detect→hedge→reset loop that mirrors the real shape so
 *   the dashboard is fully compelling with no chain connected.
 */
export function useDashboardData(): { view: DashboardView; actions: DashboardActions } {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(EMPTY_SNAPSHOT);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [backtest, setBacktest] = useState<Backtest | null>(null);

  const [stateStatus, setStateStatus] = useState<LoadStatus>("loading");
  const [eventsStatus, setEventsStatus] = useState<LoadStatus>("loading");
  const [backtestStatus, setBacktestStatus] = useState<LoadStatus>("loading");
  const [stateError, setStateError] = useState<string>();
  const [eventsError, setEventsError] = useState<string>();
  const [backtestError, setBacktestError] = useState<string>();

  // mode: undefined until first /api/state response resolves it
  const [demoMode, setDemoMode] = useState<boolean | undefined>(undefined);
  const [demo, setDemo] = useState<DemoSnap | null>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);

  // wallet (live "fire test swap" action only)
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [walletError, setWalletError] = useState<string>();
  const [fireBusy, setFireBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>();

  // ── Backtest (file-backed; works regardless of chain env) ──
  const fetchBacktest = useCallback(async () => {
    setBacktestStatus("loading");
    setBacktestError(undefined);
    try {
      const res = await fetch("/api/backtest", { cache: "no-store" });
      const data = (await res.json()) as Backtest;
      if (!res.ok || !Array.isArray(data.rows)) throw new Error("Backtest CSV did not load.");
      setBacktest(data);
      setBacktestStatus("ready");
    } catch (err) {
      setBacktest(null);
      setBacktestError(err instanceof Error ? err.message : "Backtest route failed.");
      setBacktestStatus("error");
    }
  }, []);

  // ── Live state + events ──
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = (await res.json()) as ApiState;
      if (!res.ok) throw new Error(data.error || "State route returned an error.");

      if (!data.configured) {
        setDemoMode(true);
        setSnapshot(EMPTY_SNAPSHOT);
      } else {
        setDemoMode(false);
        setSnapshot({
          configured: true,
          drift: numeric(data.drift),
          threshold: numeric(data.threshold),
          hedgesFired: numeric(data.hedgesFired),
          netHedge: wad(data.netHedge),
          hedgeIntent: wad(data.hedgeIntent),
        });
      }
      setStateStatus("ready");
      setStateError(undefined);
    } catch (err) {
      setStateStatus("error");
      setStateError(err instanceof Error ? err.message : "State route failed.");
    }

    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = (await res.json()) as ApiEvents;
      if (!res.ok) throw new Error("Event route returned an error.");

      if (!data.configured) {
        setEvents([]);
      } else {
        const now = Date.now();
        setEvents(
          (data.events || []).slice(0, 14).map((e, i) => ({
            id: `${e.tx || e.block || e.name || "event"}-${i}`,
            chain: e.chain || "origin",
            name: e.name || "UnknownEvent",
            detail: e.detail || "event received",
            tx: e.tx,
            block: e.block,
            receivedAt: now - i * 1000,
          })),
        );
      }
      setEventsStatus("ready");
      setEventsError(undefined);
    } catch (err) {
      setEventsStatus("error");
      setEventsError(err instanceof Error ? err.message : "Event route failed.");
    }
  }, []);

  useEffect(() => {
    fetchBacktest();
  }, [fetchBacktest]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (alive) await fetchLive();
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [fetchLive, refreshNonce]);

  // ── Demo loop (only when env is blank) ──
  useEffect(() => {
    if (demoMode !== true) return;

    let raf = 0;
    let stopped = false;
    const start = performance.now();
    let lastPush = 0;
    let evId = 0;
    let block = DEMO_BLOCK_SEED;
    let hedges = 0;
    let net = 0;
    let feed: FeedEvent[] = [];
    let cycle = -1;
    const emitted = { swaps: [false, false, false], cb: false, hedge: false };

    const hex = (n: number) => {
      let s = "";
      for (let i = 0; i < n; i += 1) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
      return s;
    };
    const make = (chain: ChainKey, name: string, detail: string): FeedEvent => {
      block += 1;
      const e: FeedEvent = {
        id: `demo-${name}-${block}-${evId++}`,
        chain,
        name,
        detail,
        tx: `0x${hex(64)}`,
        block: String(block),
        receivedAt: Date.now(),
      };
      feed = [e, ...feed].slice(0, 14);
      return e;
    };

    const frame = (now: number) => {
      if (stopped) return;
      const elapsed = now - start;
      const c = Math.floor(elapsed / T_CYCLE);
      const t = elapsed % T_CYCLE;
      if (c !== cycle) {
        cycle = c;
        emitted.swaps = [false, false, false];
        emitted.cb = false;
        emitted.hedge = false;
      }

      T_SWAP.forEach((ts, i) => {
        if (t >= ts && !emitted.swaps[i]) {
          emitted.swaps[i] = true;
          make("origin", "SwapObserved", `price moved · drift +${6 + i * 4} bps`);
        }
      });
      if (t >= T_BUILD_END && !emitted.cb) {
        emitted.cb = true;
        make("reactive", "Callback", `threshold breached · gas 220000`);
      }
      if (t >= T_HEDGE && !emitted.hedge) {
        emitted.hedge = true;
        hedges += 1;
        net = Number((net + 0.05).toFixed(4));
        make("dest", "HedgeExecuted", `hedge +0.0500 ETH · net ${net.toFixed(4)}`);
      }

      const ratio = demoRatio(t);
      const fired = t >= T_HEDGE;
      const ilBps = fired ? IL_HEDGED_BPS : ratio * IL_PEAK_BPS;

      if (now - lastPush > 40) {
        lastPush = now;
        setDemo({ ratio, fired, stage: demoStage(t), ilBps, hedgesFired: hedges, netHedge: net, events: feed });
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [demoMode]);

  // ── Wallet plumbing (live action) ──
  const refreshWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as Address[];
      if (accounts?.[0]) {
        const idHex = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
        setAccount(accounts[0]);
        setChainId(Number.parseInt(idHex, 16));
      }
    } catch {
      /* wallet not ready — ignore */
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x515" }] });
      await refreshWallet();
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Network switch failed.");
    }
  }, [refreshWallet]);

  const fireTestSwap = useCallback(async () => {
    setActionMessage(undefined);
    setWalletError(undefined);
    if (!canSwap) {
      setActionMessage("Swap config missing: set NEXT_PUBLIC_SWAP_ROUTER, pool currencies, and hook address.");
      return;
    }
    if (!window.ethereum) {
      setWalletError("No injected wallet found. Connect a testnet wallet to fire a swap.");
      return;
    }
    if (!account) {
      try {
        const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as Address[];
        const idHex = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
        setAccount(accounts[0]);
        setChainId(Number.parseInt(idHex, 16));
      } catch (err) {
        setWalletError(err instanceof Error ? err.message : "Wallet request rejected.");
      }
      return;
    }
    if (chainId !== unichainSepolia.id) {
      setActionMessage("Switch to Unichain Sepolia before firing the swap.");
      return;
    }

    setFireBusy(true);
    try {
      const walletClient = createWalletClient({ chain: unichainSepolia, transport: custom(window.ethereum) });
      const key = { currency0: config.currency0!, currency1: config.currency1!, fee: 3000, tickSpacing: 60, hooks: config.hook! };
      const params = { zeroForOne: true, amountSpecified: -1_000_000_000_000_000n, sqrtPriceLimitX96: 4295128740n };

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
      setActionMessage(`Swap submitted ${short(tx)}. Watching /api/events for SwapObserved.`);
      setRefreshNonce((v) => v + 1);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Transaction rejected.");
    } finally {
      setFireBusy(false);
    }
  }, [account, chainId]);

  const retry = useCallback(() => {
    setRefreshNonce((v) => v + 1);
    fetchBacktest();
  }, [fetchBacktest]);

  // ── Compose the view ──
  const view = useMemo<DashboardView>(() => {
    const isDemo = demoMode === true;

    if (isDemo) {
      const d = demo;
      const ratio = d?.ratio ?? 0;
      const fired = d?.fired ?? false;
      const ilBps = d?.ilBps ?? 0;
      const protectionTone: "hedge" | "drift" = fired || ratio < 0.5 ? "hedge" : "drift";
      const protectionLabel = fired
        ? "Protected · hedge active"
        : ratio >= 1
          ? "Breach · hedging"
          : ratio >= 0.5
            ? "Drift building"
            : "Protected · monitoring";
      return {
        mode: "demo",
        // demo is always "ready" once the loop has produced a frame; show loading until then
        stateStatus: d ? "ready" : "loading",
        eventsStatus: d ? "ready" : "loading",
        backtestStatus,
        positionValue: BASE_NOTIONAL * (1 - ilBps / 10_000),
        positionEth: 12.5,
        ilBps,
        hedgesFired: d?.hedgesFired ?? 0,
        netHedge: d?.netHedge ?? 0,
        driftBps: Math.round(ratio * 50),
        thresholdBps: 50,
        driftRatio: Math.min(1, ratio),
        crossed: ratio >= 1,
        fired,
        stage: d?.stage ?? "listening",
        protectionTone,
        protectionLabel,
        events: d?.events ?? [],
        backtest,
        backtestError,
      };
    }

    // LIVE
    const stage = liveStage(events, snapshot);
    const ratio = snapshot.threshold && snapshot.drift !== null ? snapshot.drift / snapshot.threshold : 0;
    const clamped = Math.max(0, Math.min(1, ratio));
    const fired = stage === "hedged";
    const ilBps = !snapshot.configured ? null : fired ? IL_HEDGED_BPS : clamped * IL_PEAK_BPS;
    const protectionTone: "hedge" | "drift" = fired || clamped < 0.5 ? "hedge" : "drift";
    const protectionLabel = !snapshot.configured
      ? "Awaiting config"
      : fired
        ? "Protected · hedge active"
        : clamped >= 1
          ? "Breach · hedging"
          : clamped >= 0.5
            ? "Drift building"
            : "Protected · monitoring";

    return {
      mode: "live",
      stateStatus,
      eventsStatus,
      backtestStatus,
      positionValue: ilBps === null ? null : BASE_NOTIONAL * (1 - ilBps / 10_000),
      positionEth: snapshot.configured ? 12.5 : null,
      ilBps,
      hedgesFired: snapshot.hedgesFired,
      netHedge: snapshot.netHedge,
      driftBps: snapshot.drift,
      thresholdBps: snapshot.threshold,
      driftRatio: clamped,
      crossed: clamped >= 1,
      fired,
      stage,
      protectionTone,
      protectionLabel,
      events,
      backtest,
      stateError,
      eventsError,
      backtestError,
    };
  }, [demoMode, demo, snapshot, events, backtest, stateStatus, eventsStatus, backtestStatus, stateError, eventsError, backtestError]);

  const actions: DashboardActions = {
    retry,
    fireTestSwap,
    switchNetwork,
    canFireTestSwap: canSwap && Boolean(account) && chainId === unichainSepolia.id && !fireBusy,
    fireBusy,
    actionMessage,
    walletError,
    wrongNetwork: Boolean(account) && chainId !== undefined && chainId !== unichainSepolia.id,
  };

  return { view, actions };
}

export { chainMeta, config, canSwap, short };
