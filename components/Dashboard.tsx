"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom, formatEther } from "viem";
import { config, canSwap, chainMeta } from "../lib/config";
import { swapRouterAbi } from "../lib/abis";
import { unichainSepolia } from "../lib/chains";
import SignalFlow from "./SignalFlow";

declare global {
  interface Window { ethereum?: any }
}

type Kind = "origin" | "reactive" | "dest";
type Feed = { id: string; chain: Kind; name: string; detail: string; tx?: string };
type State = {
  configured: boolean;
  drift: number; threshold: number; hedgesFired: number;
  hedgeIntent: number; netHedge: number; hedgeCount: number;
};
const Z: State = { configured: false, drift: 0, threshold: 50, hedgesFired: 0, hedgeIntent: 0, netHedge: 0, hedgeCount: 0 };

const wad = (s?: string) => (s ? Number(formatEther(BigInt(s))) : 0);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

/** Lightweight count-up for changing numbers. */
function Roll({ value, dp = 0 }: { value: number; dp?: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current, to = value, start = performance.now(), dur = 600;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}</>;
}

export default function Dashboard() {
  const [s, setS] = useState<State>(Z);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [bt, setBt] = useState({ unhedgedBps: 202, hedgedBps: 14, reduction: 93 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [liveOk, setLiveOk] = useState(false);
  const seq = useRef(0);

  const pushFeed = useCallback((chain: Kind, name: string, detail: string, tx?: string) => {
    seq.current += 1;
    setFeed((f) => [{ id: `${Date.now()}-${seq.current}`, chain, name, detail, tx }, ...f].slice(0, 30));
  }, []);

  // backtest headline (once)
  useEffect(() => {
    fetch("/api/backtest")
      .then((r) => r.json())
      .then((d) => setBt({ unhedgedBps: d.unhedgedBps, hedgedBps: d.hedgedBps, reduction: d.reduction }))
      .catch(() => {});
  }, []);

  // poll state + events
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await (await fetch("/api/state", { cache: "no-store" })).json();
        if (!alive) return;
        if (d.configured && !d.error) {
          setLiveOk(true);
          setS({
            configured: true,
            drift: Number(d.drift), threshold: Number(d.threshold || 50), hedgesFired: Number(d.hedgesFired),
            hedgeIntent: wad(d.hedgeIntent), netHedge: wad(d.netHedge), hedgeCount: Number(d.hedgeCount),
          });
        } else {
          setLiveOk(false);
          setS((p) => ({ ...p, configured: Boolean(d.configured) }));
        }
        const ev = await (await fetch("/api/events", { cache: "no-store" })).json();
        if (alive && ev.configured && Array.isArray(ev.events) && ev.events.length) {
          setFeed(
            ev.events.slice(0, 30).map((e: any, i: number) => ({
              id: `${e.tx}-${i}`, chain: e.chain, name: e.name, detail: e.detail, tx: e.tx,
            })),
          );
        }
      } catch {
        if (alive) setLiveOk(false);
      }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const pushPrice = useCallback(async () => {
    setBusy(true); setNote("");
    try {
      if (!canSwap || !window.ethereum) {
        pushFeed("origin", "SwapObserved", "demo · simulated price move");
        setTimeout(() => pushFeed("reactive", "Callback", "demo · drift > threshold → fire"), 1100);
        setTimeout(() => pushFeed("dest", "HedgeExecuted", "demo · hedge rebalanced on Base"), 2400);
        setNote(canSwap ? "Connect a wallet to send a real swap." : "Demo mode — set NEXT_PUBLIC_* addresses for live mode.");
        return;
      }
      const wallet = createWalletClient({ chain: unichainSepolia, transport: custom(window.ethereum) });
      const [account] = await wallet.requestAddresses();
      await wallet.writeContract({
        account, address: config.currency0!, abi: swapRouterAbi, functionName: "approve",
        args: [config.swapRouter!, 2n ** 255n],
      });
      const key = { currency0: config.currency0!, currency1: config.currency1!, fee: 3000, tickSpacing: 60, hooks: config.hook! };
      const params = { zeroForOne: true, amountSpecified: -1_000_000_000_000_000n, sqrtPriceLimitX96: 4295128740n };
      const tx = await wallet.writeContract({
        account, address: config.swapRouter!, abi: swapRouterAbi, functionName: "swap",
        args: [key, params, { takeClaims: false, settleUsingBurn: false }, "0x"],
      });
      pushFeed("origin", "swap()", `sent ${short(tx)}`, tx);
      setNote("Swap sent — watch the hedge land on Base within seconds.");
    } catch (e: any) {
      setNote(e?.shortMessage || e?.message || "Transaction rejected.");
    } finally {
      setBusy(false);
    }
  }, [pushFeed]);

  const gauge = s.threshold > 0 ? Math.min(100, (s.drift / s.threshold) * 100) : 0;
  const delay = (i: number) => ({ animationDelay: `${i * 90}ms` });

  return (
    <main className="wrap">
      <header className="top reveal" style={delay(0)}>
        <p className="eyebrow">UHI9 · Impermanent loss &amp; yield</p>
        <span className={`live ${liveOk ? "" : "idle"}`}>
          <span className="dot" /> {liveOk ? "live · on-chain" : s.configured ? "connecting" : "demo mode"}
        </span>
      </header>

      <h1 className="reveal" style={delay(1)}>Reactive<em>Hedge</em></h1>
      <p className="lede reveal" style={delay(2)}>
        A Uniswap v4 hook that hedges impermanent loss <b>before the arbitrage lands</b>. A Reactive
        Smart Contract watches the pool's price events and fires a cross-chain hedge in seconds —
        acting in the window a hook alone is blind to.
      </p>

      <section className="hero reveal" style={delay(3)}>
        <div>
          <div className="label">Impermanent loss, hedged — 30-day ETH/USDC backtest</div>
          <div className="figure">
            <span className="from">{(bt.unhedgedBps / 100).toFixed(2)}%</span>
            <span className="arrow">→</span>
            <span className="to">{(bt.hedgedBps / 100).toFixed(2)}%</span>
          </div>
        </div>
        <div className="big">−{bt.reduction}%<small>vs unhedged baseline</small></div>
      </section>

      <section className="pipeline reveal" style={delay(4)}>
        <SignalFlow />
        <div className="cols">
          <div className="card origin">
            <div className="role">Origin</div>
            <div className="net">{chainMeta.origin.name} · {chainMeta.origin.id}</div>
            <div className="name">ReactiveHedgeHook</div>
            <div className="metric">
              <span className="cap">Hedge intent</span>
              <span className="v"><Roll value={s.hedgeIntent} dp={4} /></span>
            </div>
            <div className="stat"><span className="k">POOL</span><span className="val">{short(config.poolId)}</span></div>
            <div className="stat"><span className="k">HOOK</span><span className="val">{short(config.hook)}</span></div>
          </div>

          <div className="card reactive">
            <div className="role">Signal layer</div>
            <div className="net">{chainMeta.reactive.name} · {chainMeta.reactive.id}</div>
            <div className="name">HedgeReactiveContract</div>
            <div className="metric">
              <span className="cap">Cumulative drift</span>
              <span className="v"><Roll value={s.drift} /></span><span className="u">/ {s.threshold} bps</span>
            </div>
            <div className="gauge">
              <div className="track"><i style={{ width: `${gauge}%` }} /></div>
              <div className="ann"><span>ACCUMULATING</span><span>FIRE @ {s.threshold}</span></div>
            </div>
            <div className="stat"><span className="k">HEDGES FIRED</span><span className="val"><Roll value={s.hedgesFired} /></span></div>
          </div>

          <div className="card dest">
            <div className="role">Destination</div>
            <div className="net">{chainMeta.dest.name} · {chainMeta.dest.id}</div>
            <div className="name">HedgeExecutor</div>
            <div className="metric">
              <span className="cap">Net hedge position</span>
              <span className="v"><Roll value={s.netHedge} dp={4} /></span>
            </div>
            <div className="stat"><span className="k">HEDGE COUNT</span><span className="val"><Roll value={s.hedgeCount} /></span></div>
            <div className="stat"><span className="k">STATUS</span><span className="val">{liveOk ? "tracking" : "—"}</span></div>
          </div>
        </div>
      </section>

      <div className="controls reveal" style={delay(5)}>
        <button className="btn" onClick={pushPrice} disabled={busy}>{busy ? "working…" : "↗ push external price"}</button>
        <a className="linkout" href={config.reactscan} target="_blank" rel="noreferrer">Reactscan ↗</a>
        {note && <span className="note">{note}</span>}
      </div>

      {!s.configured && (
        <div className="demo-banner reveal" style={delay(6)}>
          <b>Demo mode.</b> No deployed addresses configured. Copy <code>.env.local.example</code> → <code>.env.local</code> and
          fill <code>NEXT_PUBLIC_*</code> (or server <code>RPC_*</code>) to light up live reads. The button still animates the loop.
        </div>
      )}

      <section className="tape reveal" style={delay(7)}>
        <div className="tape-head">
          <h2>Live event feed</h2>
          <span className={`live ${liveOk ? "" : "idle"}`} style={{ border: "none", padding: 0 }}>
            <span className="dot" /> {feed.length} events
          </span>
        </div>
        {feed.length === 0 ? (
          <div className="tape-empty">No events yet — push the external price to start the loop.</div>
        ) : (
          feed.map((e) => (
            <div className="tape-row" key={e.id}>
              <span className="chip" style={{ color: chainMeta[e.chain].color }}>
                <span className="d" style={{ background: chainMeta[e.chain].color }} />{e.chain}
              </span>
              <span className="evt">{e.name}</span>
              <span className="det">{e.detail}</span>
              <span>
                {e.tx ? (
                  <a className="linkout" href={`${config.reactscan}/tx/${e.tx}`} target="_blank" rel="noreferrer">{short(e.tx)} ↗</a>
                ) : (
                  <span style={{ color: "var(--faint)" }}>local</span>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      <footer>
        <span>ReactiveHedge · IL hedge terminal</span>
        <span>origin → reactive → destination · hedge before the arb</span>
      </footer>
    </main>
  );
}
