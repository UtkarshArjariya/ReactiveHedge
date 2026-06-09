"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom, formatEther, type Hex } from "viem";
import {
  config, isConfigured, unichainClient, baseClient, reactiveClient, chainMeta,
} from "../lib/config";
import { hookAbi, rscAbi, executorAbi, swapRouterAbi } from "../lib/abis";
import { unichainSepolia } from "../lib/chains";

declare global {
  interface Window { ethereum?: any }
}

type Kind = "origin" | "reactive" | "dest";
type FeedItem = { id: string; t: number; chain: Kind; name: string; detail: string; tx?: string };

type Stats = {
  drift: bigint; threshold: bigint; hedgesFired: bigint;
  hedgeIntent: bigint; netHedge: bigint; hedgeCount: bigint;
};
const ZERO: Stats = { drift: 0n, threshold: 0n, hedgesFired: 0n, hedgeIntent: 0n, netHedge: 0n, hedgeCount: 0n };

const wad = (x: bigint) => Number(formatEther(x < 0n ? -x : x)) * (x < 0n ? -1 : 1);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>(ZERO);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>("");
  const seq = useRef(0);

  const push = useCallback((chain: Kind, name: string, detail: string, tx?: string) => {
    seq.current += 1;
    const item: FeedItem = { id: `${Date.now()}-${seq.current}`, t: Date.now(), chain, name, detail, tx };
    setFeed((f) => [item, ...f].slice(0, 40));
  }, []);

  // ── live reads (poll) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    const read = async () => {
      try {
        const [drift, threshold, hedgesFired] = await Promise.all([
          reactiveClient.readContract({ address: config.rsc!, abi: rscAbi, functionName: "cumulativeDrift" }),
          reactiveClient.readContract({ address: config.rsc!, abi: rscAbi, functionName: "driftThreshold" }),
          reactiveClient.readContract({ address: config.rsc!, abi: rscAbi, functionName: "hedgesFired" }),
        ]);
        const [netHedge, hedgeCount] = await Promise.all([
          baseClient.readContract({ address: config.executor!, abi: executorAbi, functionName: "netHedgePosition" }),
          baseClient.readContract({ address: config.executor!, abi: executorAbi, functionName: "hedgeCount" }),
        ]);
        const hedgeIntent = await unichainClient.readContract({
          address: config.hook!, abi: hookAbi, functionName: "hedgeIntent", args: [config.poolId as Hex],
        });
        if (alive) setStats({ drift, threshold, hedgesFired, hedgeIntent, netHedge, hedgeCount });
      } catch (e) {
        /* RPC hiccup — keep last good values */
      }
    };
    read();
    const t = setInterval(read, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // ── live event subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) return;
    const unwatchers: Array<() => void> = [];
    unwatchers.push(
      unichainClient.watchContractEvent({
        address: config.hook!, abi: hookAbi, eventName: "SwapObserved",
        onLogs: (logs) => logs.forEach((l: any) =>
          push("origin", "SwapObserved", `price ${l.args.sqrtPriceX96?.toString().slice(0, 10)}…`, l.transactionHash)),
      }),
    );
    unwatchers.push(
      reactiveClient.watchContractEvent({
        address: config.rsc!, abi: rscAbi, eventName: "Callback",
        onLogs: (logs) => logs.forEach((l: any) =>
          push("reactive", "Callback", `→ ${short(l.args._contract)} gas ${l.args.gas_limit}`, l.transactionHash)),
      }),
    );
    unwatchers.push(
      baseClient.watchContractEvent({
        address: config.executor!, abi: executorAbi, eventName: "HedgeExecuted",
        onLogs: (logs) => logs.forEach((l: any) =>
          push("dest", "HedgeExecuted", `Δ ${wad(l.args.deltaApplied).toFixed(4)} → pos ${wad(l.args.newPosition).toFixed(4)}`, l.transactionHash)),
      }),
    );
    return () => unwatchers.forEach((u) => u());
  }, [push]);

  // ── demo control: push external price (FR-23) ───────────────────────────────
  const pushPrice = useCallback(async () => {
    setBusy(true);
    setNote("");
    try {
      if (!isConfigured || !config.swapRouter || !config.currency0 || !config.currency1 || !window.ethereum) {
        // Demo mode — animate the pipeline so the UI tells the story offline.
        push("origin", "SwapObserved", "demo: simulated price move", undefined);
        setTimeout(() => push("reactive", "Callback", "demo: drift > threshold → fire", undefined), 1200);
        setTimeout(() => push("dest", "HedgeExecuted", "demo: hedge rebalanced", undefined), 2600);
        setNote(isConfigured ? "Connect a wallet to send a real swap." : "Demo mode — set contract addresses in .env.local for live mode.");
        return;
      }
      const wallet = createWalletClient({ chain: unichainSepolia, transport: custom(window.ethereum) });
      const [account] = await wallet.requestAddresses();
      // Approve then swap a small exact-input amount, moving the pool price.
      await wallet.writeContract({
        account, address: config.currency0, abi: swapRouterAbi, functionName: "approve",
        args: [config.swapRouter, 2n ** 255n],
      });
      const key = {
        currency0: config.currency0, currency1: config.currency1,
        fee: 3000, tickSpacing: 60, hooks: config.hook!,
      };
      const params = { zeroForOne: true, amountSpecified: -1_000_000_000_000_000n, sqrtPriceLimitX96: 4295128740n };
      const tx = await wallet.writeContract({
        account, address: config.swapRouter, abi: swapRouterAbi, functionName: "swap",
        args: [key, params, { takeClaims: false, settleUsingBurn: false }, "0x"],
      });
      push("origin", "swap()", `sent ${short(tx)}`, tx);
      setNote("Swap sent. Watch the feed — the hedge should land on Base within seconds.");
    } catch (e: any) {
      setNote(e?.shortMessage || e?.message || "Transaction rejected.");
    } finally {
      setBusy(false);
    }
  }, [push]);

  const driftPct = stats.threshold > 0n ? Math.min(100, Number((stats.drift * 100n) / stats.threshold)) : 0;

  return (
    <main className="wrap">
      <p className="eyebrow">UHI9 · Impermanent Loss &amp; Yield · Live</p>
      <h1>Reactive<span className="hl">Hedge</span></h1>
      <p className="lede">
        A Uniswap v4 hook that hedges impermanent loss <b>before the arbitrage lands</b>. Watch a price
        move on the origin pool flow through the Reactive Smart Contract and rebalance the hedge on Base.
      </p>

      {!isConfigured && (
        <div className="banner">
          <b>Demo mode.</b> No contract addresses configured. Copy <span className="mono">.env.local.example</span> to{" "}
          <span className="mono">.env.local</span> and fill the deployed addresses for live reads. The button below
          animates the pipeline so the story still reads.
        </div>
      )}

      <section className="grid">
        <div className="panel origin">
          <span className="tag">Origin</span>
          <div className="chain">{chainMeta.origin.name} · {chainMeta.origin.id}</div>
          <h3>ReactiveHedgeHook</h3>
          <div className="stat"><span className="k">POOL ID</span><span className="v">{short(config.poolId)}</span></div>
          <div className="stat"><span className="k">HEDGE INTENT</span><span className="v">{wad(stats.hedgeIntent).toFixed(4)}</span></div>
          <div className="stat"><span className="k">HOOK</span><span className="v">{short(config.hook)}</span></div>
        </div>

        <div className="panel reactive">
          <span className="tag">Signal layer</span>
          <div className="chain">{chainMeta.reactive.name} · {chainMeta.reactive.id}</div>
          <h3>HedgeReactiveContract</h3>
          <div className="stat"><span className="k">CUMULATIVE DRIFT</span><span className="v">{stats.drift.toString()} bps</span></div>
          <div className="stat"><span className="k">THRESHOLD</span><span className="v">{stats.threshold.toString()} bps</span></div>
          <div className="stat"><span className="k">HEDGES FIRED</span><span className="v">{stats.hedgesFired.toString()}</span></div>
          <div className="bar"><i style={{ width: `${driftPct}%` }} /></div>
        </div>

        <div className="panel dest">
          <span className="tag">Destination</span>
          <div className="chain">{chainMeta.dest.name} · {chainMeta.dest.id}</div>
          <h3>HedgeExecutor</h3>
          <div className="stat"><span className="k">NET HEDGE POSITION</span><span className="v">{wad(stats.netHedge).toFixed(4)}</span></div>
          <div className="stat"><span className="k">HEDGE COUNT</span><span className="v">{stats.hedgeCount.toString()}</span></div>
          <div className="stat"><span className="k">EXECUTOR</span><span className="v">{short(config.executor)}</span></div>
        </div>
      </section>

      <div className="controls">
        <button className="cta" onClick={pushPrice} disabled={busy}>
          {busy ? "Working…" : "↗ Push external price"}
        </button>
        <a className="link" href={config.reactscan} target="_blank" rel="noreferrer">
          Reactscan ↗
        </a>
        {note && <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{note}</span>}
      </div>

      <section className="feed">
        <h2>Live event feed</h2>
        {feed.length === 0 ? (
          <div className="empty">No events yet — push the external price to start the loop.</div>
        ) : (
          feed.map((e) => (
            <div className="row" key={e.id}>
              <span className="evt-chain mono" style={{ color: chainMeta[e.chain].color }}>
                <span className="dot" style={{ background: chainMeta[e.chain].color }} />
                {e.chain}
              </span>
              <span className="evt-name">{e.name}</span>
              <span className="evt-detail">{e.detail}</span>
              <span>
                {e.tx ? (
                  <a className="link" href={`${config.reactscan}/tx/${e.tx}`} target="_blank" rel="noreferrer">
                    {short(e.tx)} ↗
                  </a>
                ) : (
                  <span className="mono" style={{ color: "var(--faint)" }}>local</span>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      <footer>
        <span>ReactiveHedge · live dashboard</span>
        <span>origin → reactive → destination · hedge before the arb</span>
      </footer>
    </main>
  );
}
