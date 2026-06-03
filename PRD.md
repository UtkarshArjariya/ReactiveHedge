# PRD — ReactiveHedge

**Product:** ReactiveHedge — cross-chain, event-driven impermanent-loss protection for Uniswap v4 LPs
**Context:** Uniswap Hook Incubator, UHI9 ("Impermanent Loss & Yield") Hookathon submission
**Author:** (you) — solo build
**Timeline:** ~10 working days to Demo Day
**Status:** Draft v1

---

## 1. Problem

Liquidity providers on AMMs bleed value to **impermanent loss / loss-versus-rebalancing (LVR)**.
The mechanism: a token's price moves on a fast venue (a CEX, a perp DEX like Hyperliquid). The
AMM pool is now stale. Arbitrageurs trade against the stale pool and pocket the difference. The LP
eats the loss. Studies put LVR at a meaningful fraction of LP fee income on volatile pairs.

Uniswap v4 hooks can customize pool behavior, but they share a structural blind spot: **a hook
only runs when the pool is touched** (a swap, a liquidity change). It cannot act in the window
that matters most — when the price has moved *elsewhere* and no one has yet arbitraged the pool.
Existing v4 IL tools (dynamic fees, am-AMM auctions, shapeshifting liquidity) all react at swap
time, i.e. *after* the toxic order has already arrived.

## 2. Insight

**Reactive Network closes the loop.** A Reactive Smart Contract can subscribe to events on an
arbitrary chain (a Pyth price update on Base, a swap on Hyperliquid's HyperEVM) and fire a
cross-chain callback into a Uniswap v4 hook on Unichain. This lets the hook respond to an
*external* price move within seconds — before the stale-pool arbitrage completes.

No prior UHI winner has built this pattern. It genuinely requires *both* technologies: v4 hooks
for the programmable AMM surface, Reactive for the cross-chain event trigger. A keeper bot could
approximate it, but only by trusting an off-chain actor; Reactive makes the trigger an auditable
on-chain primitive.

## 3. Goal & success criteria

**Goal:** Ship an MVP that demonstrably reduces LP impermanent loss by hedging cross-chain in
response to off-pool price moves, and present it as a clean live demo on Demo Day.

Success =
- **S1.** A live demo where an external price move triggers a hedge on another chain in real time,
  visible end-to-end (origin event → Reactive → destination callback) within ~30 seconds.
- **S2.** A backtest or simulation producing one concrete number: "ReactiveHedge reduces IL by
  X% on [pair] over [period]" vs. an unhedged baseline.
- **S3.** Open-source repo with a clear README and architecture diagram; "fork this" energy.
- **S4 (stretch).** Positioned to stack multiple sponsor angles: cross-chain (Across), hedge venue
  (Hyperliquid), theme prize (Uniswap).

**Non-goals:** production-grade perp execution, multi-pool generality, audited math, mainnet TVL.

## 4. Users

- **Primary (demo persona):** a passive LP on a volatile pair (e.g. ETH/USDC) who wants IL
  protection without actively managing positions.
- **Secondary:** v4 pool deployers who want to offer "IL-protected" pools as a differentiator.
- **Judges:** UHI / Atrium / Uniswap Foundation + sponsor reps. They reward novel primitives,
  working demos, and a crisp "why does this need both technologies" story.

## 5. Core user story

> As an LP, when I add liquidity to a ReactiveHedge pool, the protocol automatically opens a
> delta-offsetting hedge sized to my exposure. As the market price drifts on a faster venue, the
> hedge auto-rebalances cross-chain so my net position stays closer to delta-neutral, cutting my
> impermanent loss. When I withdraw, the hedge closes.

## 6. Functional scope (MVP)

In scope:
1. A v4 hook that tracks per-LP net delta on add/remove liquidity and emits a structured price/
   swap event.
2. An RSC that subscribes to that event (and optionally a Pyth feed on another chain), accumulates
   price drift, and fires a cross-chain callback when drift crosses a threshold.
3. A destination contract that receives the callback and updates a (mock) hedge position,
   emitting the event that drives the demo.
4. Deploy scripts for all three chains, run in dependency order.
5. A pool-creation + liquidity-seeding script.
6. A minimal frontend dashboard: pool position, RSC drift state, hedge position, live event feed.
7. A backtest script producing the IL-reduction number.

Explicitly out (post-hackathon): real Hyperliquid perp orders, multi-LP accounting at scale,
insurance-fund actuarial pricing, governance, upgradeability.

## 7. Demo narrative (3 minutes)

1. **Pain (10s):** "LPs lose to LVR because the pool is blind to price moves elsewhere."
2. **Insight (20s):** "Hooks can't see across chains. Reactive can." Show the diagram.
3. **Live demo (90s):** Add liquidity → hedge opens. Push the external price on the demo control →
   within seconds, the Reactscan feed shows the callback firing and the hedge rebalancing on the
   destination chain. This is the hero moment.
4. **Number (40s):** "On a 30-day ETH/USDC backtest, this cuts IL by X%." Show the chart.
5. **Next (20s):** "Swap the mock hedge for live Hyperliquid perps; open to any oracle-priced pair."

## 8. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cross-chain plumbing eats the timeline | High | Day-3 gate: prove a callback round-trip before any IL math. Fallback to ReactiveDynamicFee. |
| Delta math is wrong / too ambitious | Med | Start with full-range or fixed-ratio hedge; closed-form delta in `DeltaMath.sol` with KA tests. |
| HookMiner / CREATE2 deploy friction | Med | Get a trivial hook deploying Day 1 before adding logic. |
| Reactive latency makes demo feel slow | Med | Frame as "seconds," not "instant." Pre-stage the demo; rehearse the hero clip. |
| Callback spoofing / auth bug | Low (if disciplined) | Enforce proxy + RVM-id checks everywhere; test the revert paths. |
| "Looks like a keeper bot" critique | Med | Lead with the trust/auditability argument; show the on-chain subscription. |

## 9. Fallback (if Day-3 gate fails)

**ReactiveDynamicFee** — same three-contract rails, much simpler payload. The RSC watches an
external volatility/price event and, on threshold, calls a setter that updates the pool's dynamic
LP fee *before the next swap*. Demo: bump external price → Unichain pool fee jumps within ~10s.
Smaller surface, still novel (first hook to set fees from *external-chain* volatility), and reuses
~80% of the code.

## 10. Differentiation / prior art

- **UniCast (UHI1 winner):** forward-looking dynamic fees from options-implied vol. ReactiveHedge
  is the cross-chain successor — instead of implied vol, it reads *actual* price moves on the
  faster venue. Cite this lineage; judges already validated it.
- **Bunni v2:** re-hypothecates idle capital; reacts at swap time only. (Also a cautionary tale —
  its Sept 2025 exploit came from novel hook math, so we lean on well-understood delta hedging.)
- **am-AMM / LVR auctions:** recapture LVR via auctions at swap time. ReactiveHedge *pre-empts*
  rather than recaptures.
