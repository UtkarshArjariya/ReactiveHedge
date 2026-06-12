<!--
  FILE LOCATION: repository root  ->  ./AGENTS.md
  Repo-wide instruction file for coding agents (Codex, Cursor, Gemini CLI, ...).
  The repo ROOT is the Next.js app, so frontend + backend rules live here.
  A nested ./contracts/AGENTS.md takes precedence for Solidity work.
  Explicit user chat prompts override everything here.
-->

# AGENTS.md — ReactiveHedge

> A **Uniswap v4 hook** that gives LPs **cross-chain, event-driven impermanent-loss protection**.
> When price drifts, a **Reactive Smart Contract** detects it and fires a **cross-chain callback** that
> hedges the LP's exposure — *before arbitrageurs drain the stale pool.*
>
> **Core insight:** v4 hooks can only act when the pool is touched; Reactive lets the hook act when the
> price moves *elsewhere* — which is exactly when IL accrues.

Hackathon MVP for the **Uniswap Hook Incubator (UHI9)**, "Impermanent Loss & Yield" track. Optimize for
**demo-ability and correctness of the core loop**, not production completeness. Win condition: a clean
live demo of a cross-chain hedge firing, plus a backtest number. **The build is currently done & green
(see §9).**

Read this file fully before changing anything. When it conflicts with your defaults, this file wins.

---

## 1. The three-contract architecture (memorize — never confuse the chains)

Three contracts on three **testnets**. Never mix mainnet/testnet; if we ever flip, all three move together.

| Contract                | Chain (testnet)            | chainId   | Role                                                                      |
|-------------------------|----------------------------|-----------|--------------------------------------------------------------------------|
| `ReactiveHedgeHook`     | **Unichain Sepolia**       | `1301`    | v4 hook. Tracks per-LP delta, emits `SwapObserved`, receives rebalance callbacks. |
| `HedgeReactiveContract` | **Reactive Lasna**         | `5318007` | The RSC. Subscribes to `SwapObserved`, accumulates drift, fires cross-chain callbacks. |
| `HedgeExecutor`         | **Base Sepolia**           | `84532`   | Destination. Validates the callback, updates the (mock) hedge, emits `HedgeExecuted`. |

**Data flow (this is the whole product):**

```
swap on Unichain Sepolia
  → ReactiveHedgeHook emits SwapObserved
    → HedgeReactiveContract.react() (in the ReactVM) accumulates drift
      → drift > threshold  → emit Callback(destination, payload)
        → Reactive proxy calls HedgeExecutor.onReactiveRebalance() on Base Sepolia
          → netHedgePosition updated, HedgeExecuted fires        ← the demo hero moment
```

> Note: the destination is **Base Sepolia** with a **mock hedge** executor. There is no HyperEVM /
> Hyperliquid / Pyth in this design — an earlier perp-hedge concept was dropped. Don't reintroduce it.

---

## 2. Repository layout — ONE Next.js app + a `contracts/` Foundry project

The repo root **is** the Next.js App Router app. The "backend" is just server-side route handlers; there
is **no separate backend or database**. All Solidity is isolated under `contracts/`.

```
reactivehedge/                              ← repo root IS the Next.js app
├── AGENTS.md                               ← you are here (project + app rules)
├── app/                                    Next.js App Router
│   ├── api/state/route.ts                  server-side viem reads — live contract state   ┐
│   ├── api/events/route.ts                 server-side viem reads — event log             ├ "the backend"
│   ├── api/backtest/route.ts               serves contracts/backtest/results.csv          ┘
│   ├── page.tsx                            the dashboard (single page)
│   ├── layout.tsx
│   └── globals.css                         the design system (editorial terminal)
├── components/
│   ├── Dashboard.tsx                       state panels + backtest + event log
│   └── SignalFlow.tsx                      the cross-chain flow visualization (signature element)
├── lib/
│   ├── config.ts                           CLIENT-exposed subset (wallet demo + display only)
│   ├── server.ts                           SERVER-ONLY (RPC URLs, private reads) — never import client-side
│   ├── chains.ts                           the three chain definitions
│   └── abis.ts                             contract ABIs
├── remappings.txt                          editor import resolution only (NO comment lines)
├── tsconfig.json                           must `exclude: ["contracts"]`
├── .env.local                              app env (gitignored): server RPC_* + public NEXT_PUBLIC_*
├── aderyn.toml                             Solidity static analyzer config
└── contracts/                              self-contained Foundry project (see contracts/AGENTS.md)
    ├── AGENTS.md                           ← Solidity rules (PRECEDENCE inside contracts/)
    ├── src/ … script/ … test/ … backtest/
    ├── lib/                                forge submodules (v4-core, reactive-lib, …)
    └── .env                                Foundry env (gitignored)
```

**Server/client split (verified in code — keep it this way):** the browser **never calls an RPC
directly**. Every chain read goes through `app/api/*` handlers using `lib/server.ts`, so RPC URLs stay
private/server-only. `lib/config.ts` is the only chain config the client bundle sees.

**Demo mode:** with blank/missing env, the app runs an **animated demo loop** so it always shows
something live during a pitch. Treat demo mode as a first-class state, not a fallback hack.

---

## 3. How to run (two surfaces, two roots)

```bash
# ── App (frontend + the api/* backend) — from REPO ROOT ──
npm install
npm run dev            # local dev (http://localhost:3000)
npm run build          # production build — must pass before "done"
npm run lint
# App env lives in ./.env.local  (server RPC_* + public NEXT_PUBLIC_*)

# ── Contracts — from ./contracts (NOT the root) ──
export PATH="$HOME/.foundry/bin:$PATH"   # forge/cast aren't on the default PATH
cd contracts
forge build
forge test
# Foundry env lives in ./contracts/.env
```

Prefer file-scoped checks while iterating: `npm run lint -- app/page.tsx`,
`npx tsc --noEmit`, and `forge test --match-path test/<File>.t.sol`. Run the relevant checks and fix
failures yourself before declaring a task done.

---

## 4. Tech stack & versions (do NOT change without asking)

- **Foundry** (stable). **Solidity 0.8.26**, `evm_version = cancun`, `via_ir = true`.
- **Uniswap v4**: `v4-core` pinned **v4.0.0** (+ `v4-periphery` installed for fidelity, but **nothing
  imports from it**). `BaseHook` is **vendored** at `contracts/src/base/BaseHook.sol` (latest
  v4-periphery removed it from `src/utils/`). `HookMiner` vendored in `contracts/test/utils/`.
- **Reactive**: `reactive-lib` submodule. **The installed lib source always wins over the docs.**
- **Frontend**: **Next.js pinned 14.2.x** (security patch — don't bump blindly) + **viem**. One page.
  No separate backend/database; the only "backend" is the `app/api/*` route handlers.
- **Design system** ("editorial terminal"): **Instrument Serif** (display) + **JetBrains Mono** (all
  data/numbers) + **Hanken Grotesk** (body). Full UI brief in `FRONTEND_DESIGN_PROMPT.md`.

---

## 5. Hard rules (violating these breaks the build or the demo)

1. **Hook permission flags MUST match the deployed address.** `getHookPermissions()` must equal the
   flags passed to `HookMiner.find(...)` — update **both** when you change active callbacks, or deploy
   reverts with `HookAddressNotValid`.
2. **Validate the cross-chain callback sender.** Every callback receiver must
   `require(msg.sender == CALLBACK_PROXY)` **AND** `require(rvmId == AUTHORIZED_RVM_ID)`. Skipping this
   lets anyone spoof a hedge — the #1 security mistake.
3. **The RSC has a dual identity** (Reactive Network instance vs ReactVM instance). Guard subscriptions
   with `if (!vm)`, guard `react()` with `vmOnly`. **Never call `subscribe` from inside the VM.**
4. **Never mix mainnet and testnet.** Everything is testnet; if we flip, all three contracts move together.
5. **Callback gas:** min **100,000** (lower is silently ignored), max **900,000** per RVM tx; budget
   **200k–300k**.
6. **Fund the RSC** — it pays for its own callbacks via `AbstractPayer` / `depositTo`. Send REACT after
   deploy. **Underfunded RSCs get blocklisted.**
7. **Reorgs can invalidate sent callbacks** (Reactive doesn't wait for finality) — keep hedge actions
   **idempotent**.
8. **Secrets:** `.env` / `.env.local` are gitignored — use a **fresh dev wallet only**, never a real key.
9. **Build hygiene:** `remappings.txt` must have **no comment lines** (forge errors on them); Next
   `tsconfig.json` must `exclude: ["contracts"]`; the browser must never call an RPC directly (go through
   `app/api/*`).

---

## 6. Addresses to verify against live docs before deploying

Read these from env and verify against official sources — **do not trust hardcoded values**:

- `POOL_MANAGER_UNICHAIN_SEPOLIA` → docs.uniswap.org v4 deployments.
- `CALLBACK_PROXY_*` → dev.reactive.network/origins-and-destinations.
- `REACTIVE_SYSTEM_CONTRACT` = `0x0000000000000000000000000000000000fffFfF` (stable).
- `CREATE2_DEPLOYER` = `0x4e59b44847b379578588920cA78FbF26c0B4956C` (stable).

---

## 7. Conventions

**Solidity** (details in `contracts/AGENTS.md`): 0.8.26, `forge fmt` is the formatter of record, full
NatSpec, custom errors, events for every observable state change (the hook's events ARE the RSC's API —
renaming one breaks the subscription). Pure IL/delta math lives in `DeltaMath.sol` (known-answer tested).

**TypeScript / app**: strict TS, no `any` outside tests. Server components by default; `"use client"`
only where wallet/hooks/state need it. **Never import `lib/server.ts` into client code.** All chain
reads go through `app/api/*`; all numbers render in JetBrains Mono with `tabular-nums`. Chain + contract
references come from `lib/chains.ts` / `lib/config.ts`, never hardcoded inline.

**Commits / PRs**: Conventional Commits, one concern per PR. State what changed, which chain(s)/surface
it touches, how it was tested, and any new env var. Open-source hygiene — clean "fork this" energy.

---

## 8. Glossary

- **IL (Impermanent Loss):** LP underperformance vs holding, driven by price divergence / stale-pool arb.
- **Hook:** Uniswap v4 contract with swap/liquidity callbacks; here it emits `SwapObserved`.
- **RSC / Reactive Contract:** event-driven contract on Reactive Lasna; runs `react()` in the ReactVM.
- **ReactVM:** the VM context the RSC executes `react()` in (vs its Reactive Network deploy context).
- **Callback Proxy / `CALLBACK_PROXY`:** the only address allowed to deliver a callback on the destination.
- **RVM-ID / `AUTHORIZED_RVM_ID`:** identifies the authorized reactive sender; validated on every callback.
- **Drift:** accumulated price divergence the RSC tracks; crossing the threshold fires the hedge.

---

## 9. Status

- Contracts, deploy/pool/swap scripts, **~30 Foundry tests** (unit + integration on a local
  `PoolManager` + fork), the **unified Next.js frontend+backend**, and the **IL backtest** are done,
  committed, and **green**.
- **Backtest headline: IL 2.02% → 0.14% (~93% reduction)** on a 30-day ETH/USDC run. The dashboard hero
  + sparkline read `contracts/backtest/results.csv` via `/api/backtest`.
- **Remaining (non-code):** the 60-second demo clip + the hackathon submission.

---

## 10. References

- AGENTS.md format: https://agents.md/
- Reactive docs: https://dev.reactive.network/ • origins/destinations: https://dev.reactive.network/origins-and-destinations
- Reactive demos: https://github.com/Reactive-Network/reactive-smart-contract-demos
- Uniswap v4 template/docs: https://github.com/uniswapfoundation/v4-template • https://docs.uniswap.org/contracts/v4/overview
