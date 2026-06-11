# ReactiveHedge

> Cross-chain, event-driven impermanent-loss protection for Uniswap v4 LPs.
> **UHI9 Hookathon** — *Impermanent Loss & Yield* track.

A Uniswap v4 hook can only act when the pool is *touched*. But impermanent loss
accrues when the price moves **elsewhere** — and by the time an arbitrageur
touches the stale pool, the LP has already lost. ReactiveHedge closes that gap: a
**Reactive Smart Contract** watches the hook's price events and fires a
**cross-chain callback** that rebalances the LP's hedge *before the arb lands*.

**Headline:** on a 30-day ETH/USDC backtest, frequent pre-arb rebalancing cuts
impermanent loss from **2.02% → 0.14% (~93% reduction)** — see [`backtest/`](backtest/).

It genuinely needs *both* technologies: v4 hooks for the programmable AMM surface,
Reactive for the cross-chain event trigger. A keeper bot could approximate it only
by trusting an off-chain actor; Reactive makes the trigger an auditable on-chain
primitive.

---

## Architecture

Open [`ARCHITECTURE.html`](ARCHITECTURE.html) for the visual version. Three
contracts on three testnets:

| Contract | Chain (testnet) | Role |
|---|---|---|
| `ReactiveHedgeHook` | Unichain Sepolia (1301) | v4 hook. Tracks per-LP delta, emits `SwapObserved`, receives rebalance callbacks. |
| `HedgeReactiveContract` | Reactive Lasna (5318007) | The RSC. Subscribes to `SwapObserved`, accumulates drift, fires cross-chain callbacks. |
| `HedgeExecutor` | Base Sepolia (84532) | Destination. Validates the callback, updates the (mock) hedge, emits `HedgeExecuted`. |

```
swap on Unichain → ReactiveHedgeHook emits SwapObserved
  → HedgeReactiveContract.react() in the ReactVM accumulates drift
    → drift > threshold → emit Callback(destination, payload)
      → Reactive proxy calls HedgeExecutor.onReactiveRebalance() on Base
        → netHedgePosition updated, HedgeExecuted fires   ← the demo hero moment
```

## Layout — one Next.js app + a `contracts/` Foundry project

The repo root **is** the Next.js app (frontend + backend route handlers in one).
All Solidity lives under `contracts/`.

```
app/                                   Next.js App Router
  api/state | api/events | api/backtest  server-side viem reads (the "backend")
  page.tsx | layout.tsx | globals.css    the dashboard + design system
components/                            Dashboard, SignalFlow (UI)
lib/                                   config (client) + server (server-only) + chains/abis
contracts/                             Foundry project
  src/hooks/ReactiveHedgeHook.sol        v4 hook (Unichain Sepolia)
  src/reactive/HedgeReactiveContract.sol RSC (Reactive Lasna)
  src/destination/HedgeExecutor.sol      destination (Base Sepolia)
  src/libraries/DeltaMath.sol            pure IL / delta math (KA-tested)
  src/base/BaseHook.sol                  self-contained v4 hook base
  script/                                deploy + pool + swap + backtest scripts
  test/                                  unit, integration (local PoolManager), fork
  backtest/                              IL backtest output + chart
```

The browser never calls an RPC directly — the `app/api/*` route handlers do all
chain reads server-side (no CORS, optional private RPC via `RPC_*` env). The only
client-side write is the wallet-driven "push external price" demo control.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (stable) — `forge 1.x`
- Node 18+

## Quickstart

```bash
git clone <this-repo> && cd ReactiveHedge
git submodule update --init --recursive   # v4-core, v4-periphery, reactive-lib, forge-std

# contracts
( cd contracts && forge build && forge test )   # 29 pass, 1 fork test skipped offline

# app (frontend + backend)
npm install
cp .env.local.example .env.local                # blank = demo mode; fill addresses for live
npm run dev                                       # http://localhost:3000
```

Contract tech is pinned (CLAUDE.md): Solidity **0.8.26**, `evm_version = cancun`,
`via_ir = true`. v4-core and reactive-lib are self-contained; `BaseHook` +
`HookMiner` are vendored locally because the latest v4-periphery relocated them
out of `src/utils/`.

### Tests

```
DeltaMathTest            known-answer IL/delta vectors + fuzz (FR-16/17/18)
ReactiveHedgeHookTest    HookMiner round-trip (deployed==mined) + auth reverts (FR-1/20)
HedgeReactiveContractTest react() drift→callback, funding/refund, vmOnly (FR-9/10/11/12)
HedgeExecutorTest        valid callback + proxy/RVM auth reverts (FR-13/14, NFR-2)
IntegrationTest          full flow vs a real local v4 PoolManager (NFR-5)
ForkHookTest             Unichain Sepolia fork (skips offline) (NFR-4)
```

## Deploy & run the demo

All addresses come from `contracts/.env` (never hardcoded). Copy
`contracts/.env.example` to `contracts/.env`, use a **fresh** wallet, and **verify
the movable addresses** (PoolManager, callback proxies) against the official docs
before deploying. Run from `contracts/`:

```bash
cd contracts

# 1) Destination first (no deps)
forge script script/DeployExecutor.s.sol --rpc-url base_sepolia --broadcast
#    -> set EXECUTOR_ADDRESS in contracts/.env

# 2) Hook — mines a CREATE2 salt so the address encodes the flags (asserts deployed==mined)
forge script script/DeployHook.s.sol --rpc-url unichain_sepolia --broadcast
#    -> set HOOK_ADDRESS in contracts/.env

# 3) RSC — wired to hook + executor; fund it with REACT (rule #6)
forge script script/DeployReactive.s.sol --rpc-url reactive_lasna --broadcast
#    -> set RSC_ADDRESS; then update the hook's authorized RVM id if using the in-pool path

# 4) Pool + liquidity, then the trigger swap
forge script script/CreatePoolAndAddLiquidity.s.sol --rpc-url unichain_sepolia --broadcast
forge script script/Swap.s.sol --rpc-url unichain_sepolia --broadcast
```

Then put the deployed addresses in the app's `.env.local` (root) so the dashboard
reads them — see `.env.local.example`.

**Watch it land:** after the swap, the hook emits `SwapObserved`; within seconds
Reactscan shows the RSC's `Callback`, and `HedgeExecuted` fires on Base Sepolia.
That round-trip on [Reactscan](https://lasna.reactscan.net) is the Day-3 rails gate
and the demo's hero shot.

## The app (frontend + backend)

```bash
npm install
cp .env.local.example .env.local   # fill addresses (or leave blank for demo mode)
npm run dev                         # http://localhost:3000
```

A single editorial-terminal page (Instrument Serif + JetBrains Mono): the backtest
headline, an origin → reactive → destination signal flow, pool/hedge-intent, RSC
drift vs threshold, destination hedge position, a live `SwapObserved` / `Callback`
/ `HedgeExecuted` feed, a wallet "push external price" control, and a Reactscan
link. The **backend** is `app/api/{state,events,backtest}` — server-side viem
reads, so the browser never hits an RPC.

## Backtest

```bash
cd contracts
forge script script/Backtest.s.sol   # headline + contracts/backtest/results.csv
node backtest/chart.mjs               # contracts/backtest/il_chart.svg
```

The dashboard's hero figure + sparkline are served from `contracts/backtest/results.csv`
via `/api/backtest`.

→ **ReactiveHedge reduces IL by ~93%** over the 30-day ETH/USDC series. Full method
and assumptions in [`backtest/README.md`](backtest/README.md).

## Security model (the non-negotiables)

- **Callback auth** — every cross-chain entry point requires `msg.sender == callback
  proxy` **and** `rvmId == authorized RVM id`. The executor gets this from
  `AbstractCallback` (`authorizedSenderOnly` + `rvmIdOnly`); the hook checks both
  explicitly. Revert paths are tested.
- **Hook flags == address** — `getHookPermissions()` matches the mined CREATE2 salt;
  `DeployHook` asserts `deployed == mined`.
- **Dual-instance RSC** — `subscribe` under `if (!vm)`, `react` under `vmOnly`.
- **Reorg-aware** — hedge updates are reversible signed accumulators; Reactive does
  not wait for origin finality, so no irreversible action is taken per callback.
- **Testnet only**, fresh wallet, `.env` gitignored.

## Status

MVP for the hackathon. The hedge on the destination is a **mock** position update
(`HedgeExecutor` marks the seam where a real Hyperliquid/GMX-style perp order goes).
Single pool, full-range delta math. Out of scope: real perp execution, multi-LP
accounting at scale, governance, upgradeability.

## License

MIT (contracts that import reactive-lib carry its `UNLICENSED` headers per upstream).
