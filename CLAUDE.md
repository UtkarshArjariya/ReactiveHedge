# CLAUDE.md — ReactiveHedge

> This file is auto-loaded by Claude Code on every session. Keep it accurate.
> It is the single source of truth for conventions, gotchas, and "do not break" rules.

## What we are building

**ReactiveHedge** is a Uniswap v4 hook that gives liquidity providers cross-chain,
event-driven impermanent-loss protection. When the price of a pool's assets moves on a
faster price-discovery venue (Hyperliquid / a Pyth feed on another chain), a **Reactive
Smart Contract** detects the move and fires a **cross-chain callback** that rebalances or
hedges the LP's exposure on the Uniswap v4 pool — *before* arbitrageurs can drain the
stale pool.

The thesis, in one line: **v4 hooks can only act when the pool is touched; Reactive lets
the hook act when the price moves elsewhere.** That is exactly when IL accrues.

This is a hackathon MVP for the Uniswap Hook Incubator (UHI9, "Impermanent Loss & Yield"
theme). The win condition is a clean live demo of a cross-chain hedge firing in real time,
plus a backtest number ("reduces IL by X%"). Optimize for *demo-ability and correctness of
the core loop*, not production completeness.

## The three-contract architecture (memorize this)

There are THREE contracts on THREE chains. Do not confuse them.

| Contract | Chain (testnet) | Role |
|---|---|---|
| `ReactiveHedgeHook` | Unichain Sepolia (1301) | The v4 hook. Tracks LP delta, emits `SwapObserved`, receives rebalance callbacks. |
| `HedgeReactiveContract` | Reactive Lasna (5318007) | The RSC. Subscribes to hook events, computes drift, fires cross-chain callbacks. |
| `HedgeExecutor` | Base Sepolia (84532) | The destination. Receives callbacks, executes (mock) hedge. |

Data flow:
```
LP adds liquidity / swap happens on Unichain
  → ReactiveHedgeHook emits SwapObserved event
    → HedgeReactiveContract.react() runs in the ReactVM, accumulates drift
      → when drift > threshold, emits Callback(destination, payload)
        → Reactive Callback Proxy calls HedgeExecutor.onReactiveRebalance() on Base
          → hedge position updated, event emitted (the demo hero moment)
```

## Tech stack & versions (do not change without asking)

- **Foundry** (stable channel, not nightly). Solidity **0.8.26**, `evm_version = cancun`, `via_ir = true`.
- **Uniswap v4**: `v4-core` + `v4-periphery` as forge submodules (from the `uniswapfoundation/v4-template`).
- **Reactive**: `reactive-lib` submodule (`Reactive-Network/reactive-lib`).
- **Frontend** (later phases only): Next.js + viem + wagmi. One page. No backend.
- Tests: Foundry. Fork tests against Unichain Sepolia for the hook; unit tests with hand-rolled `LogRecord` for the RSC.

## Hard rules (violating these breaks the build or the demo)

1. **Hook permission flags MUST match the deployed address.** v4's PoolManager reads enabled
   hooks from the *low bits of the hook contract address*. The flags returned by
   `getHookPermissions()` must equal the flags used in `HookMiner.find(...)` in the deploy
   script. If they disagree, deployment reverts with `HookAddressNotValid`. When you change
   which hook callbacks are active, update BOTH places.

2. **Validate the cross-chain callback sender.** Reactive injects the originating RVM ID as
   the **first `address` parameter** of the callback. Every function that receives a Reactive
   callback MUST:
   - `require(msg.sender == CALLBACK_PROXY)` — only Reactive's proxy may call it.
   - `require(rvmId == AUTHORIZED_RVM_ID)` — only our RSC may trigger it.
   Skipping this lets anyone spoof a hedge/rebalance. This is the #1 security mistake.

3. **The RSC has a dual identity.** `HedgeReactiveContract` exists as two instances: one on
   the Reactive Network (does subscriptions, talks to the System Contract) and one inside the
   ReactVM (runs `react()`). Subscription calls (`service.subscribe(...)`) must be guarded with
   `if (!vm) { ... }`. `react()` must be guarded `vmOnly`. Do not call `subscribe` from inside
   the VM — emit a callback to the Reactive instance instead.

4. **Never mix mainnet and testnet.** Reactive forbids an origin on testnet with a destination
   on mainnet (or vice versa). Everything in this repo is **testnet**: Unichain Sepolia, Base
   Sepolia, Reactive Lasna. Keep it that way until the very last "mainnet flex" step, and if we
   do that, ALL three move to mainnet together.

5. **Minimum callback gas is 100,000.** Lower values are silently ignored by Reactive. Max RVM
   gas per tx is 900,000. Budget callbacks at 200,000–300,000.

6. **Fund the RSC or it gets blocklisted.** The Reactive contract pays for its own callbacks.
   Use the `AbstractPayer` pattern and `depositTo(...)`. An underfunded RSC stops working and
   can be blocklisted. After deploying the RSC, always send it REACT.

7. **Reorgs can invalidate already-sent callbacks.** Reactive does not wait for origin finality.
   Keep hedge actions idempotent / reversible where possible; don't assume a callback's origin
   event is final.

8. **`.env` is gitignored and never committed.** Secrets live only in `.env`. Use a FRESH dev
   wallet, never a wallet with real funds.

## Addresses that must be verified against live docs before deploying

These move between testnet redeploys. **Do not trust hardcoded values — read them from `.env`,
and verify `.env` against the official sources below before any deploy.**

- `POOL_MANAGER_UNICHAIN_SEPOLIA` — Uniswap v4 deployment addresses page (docs.uniswap.org).
- `CALLBACK_PROXY_BASE_SEPOLIA`, `CALLBACK_PROXY_UNICHAIN_SEPOLIA` — Reactive
  `dev.reactive.network/origins-and-destinations`.
- `REACTIVE_SYSTEM_CONTRACT` = `0x0000000000000000000000000000000000fffFfF` (stable).
- `CREATE2_DEPLOYER` = `0x4e59b44847b379578588920cA78FbF26c0B4956C` (stable, all chains).

## Repo layout

> The repo root is a single Next.js app (frontend + backend route handlers).
> All Solidity lives under `contracts/`.

```
app/                                            # Next.js App Router (the dashboard)
app/api/{state,events,backtest}/route.ts        # backend: server-side viem reads
components/ , lib/                              # UI + client/server config
contracts/src/hooks/ReactiveHedgeHook.sol       # v4 hook (Unichain Sepolia)
contracts/src/reactive/HedgeReactiveContract.sol# RSC (Reactive Lasna)
contracts/src/destination/HedgeExecutor.sol     # destination (Base Sepolia)
contracts/src/libraries/DeltaMath.sol           # LP delta / IL math (pure, unit-tested)
contracts/src/base/BaseHook.sol                 # self-contained v4 hook base (vendored)
contracts/src/interfaces/                       # shared interfaces
contracts/script/Deploy*.s.sol                  # one deploy script per contract, run in order
contracts/script/CreatePoolAndAddLiquidity.s.sol# init pool with hook + seed liquidity
contracts/test/                                 # unit + integration + (skippable) fork tests
contracts/backtest/                             # IL backtest output + chart
```

## Build order (deploy dependencies flow one way)

1. `HedgeExecutor` → Base Sepolia. (No deps.)
2. `ReactiveHedgeHook` → Unichain Sepolia. (Needs callback proxy + a placeholder RVM id, updated later.)
3. `HedgeReactiveContract` → Reactive Lasna. (Needs hook address + executor address.)
4. Fund the RSC with REACT.
5. `CreatePoolAndAddLiquidity` → Unichain Sepolia.
6. Trigger a swap → watch the callback land on Base via Reactscan.

## Definition of done (per phase — see REQUIREMENTS.md for detail)

- **Rails proven (Day 3 gate):** a Reactscan tx shows a callback fired by a real subscribed
  event, landing on a destination contract. If not hit by end of Day 3 → descope to the simpler
  "ReactiveDynamicFee" variant (see PRD §Fallback).
- **Loop closed (Day 6 gate):** end-to-end run with no manual steps between swap and hedge.
- **Demo-ready (Day 8):** 60-second clean hero clip of the cross-chain hedge firing.

## Conventions

- Solidity: explicit visibility, custom errors not `require` strings where gas matters,
  NatSpec on every external function, events for every state change the frontend or RSC needs.
- One contract per file. Interfaces in `src/interfaces/`.
- Pure math goes in `DeltaMath.sol` and gets unit tests with known-answer vectors.
- Tests: name them `test_RevertWhen_...`, `test_...`. Fork tests tagged so they can be skipped offline.
- Commits: small, present-tense ("add afterSwap delta tracking"). Commit at every green gate.

## When stuck, check these first

- Reactive base contract API (`LogRecord`, `react`, `vmOnly`, `service`, `Callback`,
  `REACTIVE_IGNORE`): read `contracts/lib/reactive-lib/src/abstract-base/AbstractReactive.sol` —
  **the installed lib source always wins over any example in our docs.**
- v4 hook patterns: our vendored `contracts/src/base/BaseHook.sol` (the latest
  v4-periphery removed BaseHook from `src/utils/`, so it is self-contained against
  `contracts/lib/v4-core` v4.0.0).
- HookMiner usage: `contracts/test/utils/HookMiner.sol` (vendored locally).

## Out of scope for the MVP (do not build unless explicitly asked)

- Real perp execution on Hyperliquid (mock it in `HedgeExecutor`; real integration is post-hackathon).
- Multi-pool / multi-LP generalization (one pool, simple position math first).
- Governance, fee tiers, upgradeability proxies, audits.
- A backend or database. The frontend reads chain state directly via viem.
