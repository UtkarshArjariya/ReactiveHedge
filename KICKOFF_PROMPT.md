# KICKOFF_PROMPT.md

Two ways to use this. (A) The session kickoff prompt — paste the block below as your **first
message** to Claude Code in the empty repo. (B) The per-phase prompts further down — use these to
start each subsequent phase cleanly. Claude Code reads `CLAUDE.md` automatically, so you don't need
to repeat the rules; these prompts point it at the spec and set the immediate objective.

---

## (A) Session kickoff — paste this first

```
You are building ReactiveHedge, a cross-chain impermanent-loss hedging system for Uniswap v4,
for the UHI9 Hookathon. Read CLAUDE.md, PRD.md, and REQUIREMENTS.md in full before doing anything —
they are the source of truth. Open ARCHITECTURE.html's structure if helpful for the data flow.

Constraints that matter most (full list in CLAUDE.md, do not violate):
- Three contracts, three testnets: ReactiveHedgeHook (Unichain Sepolia 1301),
  HedgeReactiveContract (Reactive Lasna 5318007), HedgeExecutor (Base Sepolia 84532).
- Foundry stable, Solidity 0.8.26, evm_version=cancun, via_ir=true.
- Hook permission flags must match the mined CREATE2 salt.
- Every cross-chain callback validates msg.sender == callback proxy AND rvmId == authorized id.
- The Reactive contract is dual-instance: subscribe under if(!vm), react under vmOnly.
- Testnet only. Never mix mainnet and testnet.
- All movable addresses come from .env — never hardcode PoolManager or callback-proxy addresses.

We work in phases (REQUIREMENTS.md §"Phased build plan"). Do NOT build the whole thing at once.
Today is Phase 0 only.

Phase 0 goal — scaffold and a clean baseline:
1. Initialise the project from the uniswapfoundation/v4-template (v4-core, v4-periphery, OZ).
2. Install reactive-lib as a submodule. Configure foundry.toml and remappings.txt per CLAUDE.md.
3. Create the repo layout from CLAUDE.md (src/hooks, src/reactive, src/destination,
   src/libraries, src/interfaces, script, test).
4. Add COMPILING skeleton contracts for all three (with NatSpec, events, and TODOs where real
   logic goes — do not invent IL math yet). Use BaseHook for the hook and the reactive-lib
   abstract base(s) for the RSC. IMPORTANT: before writing the RSC, open
   lib/reactive-lib/src/abstract-base/AbstractReactive.sol and use the ACTUAL installed API
   (LogRecord, react, vmOnly, service.subscribe, the Callback event, REACTIVE_IGNORE) — the lib
   source wins over any example.
5. Write a .env.example with every variable referenced, and a .gitignore that excludes .env,
   out/, cache/, broadcast/.
6. Run `forge build` and `forge test` and make them pass (template tests should still be green).

Before writing code, give me a short plan: the file list you'll create, the exact reactive-lib
base contract names you found, and any version/remapping decisions. Wait for my "go" before
generating files. After the build passes, stop and summarise what's deployable and what's stubbed.
Do not deploy anything in Phase 0 except (optionally) telling me the exact command to deploy
HedgeExecutor — I'll run deploys myself.
```

---

## (B) Per-phase prompts

### Phase 1 — Prove the rails (the critical gate)

```
Phase 1 from REQUIREMENTS.md: prove the cross-chain callback round-trip. Scope strictly to FR-4,
FR-7, FR-9, FR-10, FR-20. No IL math yet.

1. Implement SwapObserved emission in ReactiveHedgeHook (FR-4): emit
   SwapObserved(poolId, amount0, amount1, sqrtPriceX96) in afterSwap, reading the price from the
   PoolManager. Make DeployHook.s.sol mine a CREATE2 salt with HookMiner so the address encodes
   exactly the Phase-1 flags, and assert deployed == mined.
2. Implement HedgeReactiveContract: subscribe to SwapObserved on the origin (FR-7, guarded if(!vm)),
   and a minimal react() (vmOnly) that, on ANY SwapObserved, emits a Callback to
   HedgeExecutor.onReactiveRebalance with a dummy hedgeDelta and gas budget of 200000 (FR-9, FR-10).
3. Give me the exact, ordered deploy + fund commands (executor → hook → RSC → fund RSC →
   create pool + add liquidity → trigger a swap), each with the right --rpc-url and reading
   addresses from .env. Tell me precisely what to look for on Reactscan to confirm success.

Gate: I need to see a Reactscan transaction where a callback, triggered by my SwapObserved event,
lands on HedgeExecutor and HedgeExecuted fires. Help me debug until that happens. If after real
effort the cross-chain hop won't work, flag it explicitly and propose the ReactiveDynamicFee
fallback (PRD §9) rather than silently grinding.
```

### Phase 2 — Real hedge logic (second gate)

```
Phase 2 from REQUIREMENTS.md: FR-2, FR-3, FR-5, FR-6, FR-9, FR-10, FR-12, FR-13, FR-16, FR-17, FR-18,
plus NFR-2. The rails work; now make the hedge real.

1. Build src/libraries/DeltaMath.sol as PURE functions (FR-16 netDelta, FR-17 hedgeSize,
   FR-18 impermanentLoss) with known-answer unit tests. MVP may assume a full-range position to
   keep the delta closed-form — say so in comments.
2. Real per-LP delta tracking in the hook on add/remove (FR-2, FR-3); onReactiveRebalance applies
   the rebalance to internal hedge-intent state and emits RebalanceExecuted (FR-5, FR-6).
3. Real cumulative-drift accumulation + threshold in the RSC (FR-9, FR-10, FR-12) using DeltaMath
   where relevant.
4. Enforce auth on EVERY callback (FR-13, NFR-2): require proxy + rvmId; add revert tests
   (test_RevertWhen_NotProxy, test_RevertWhen_WrongRvm).

Stop at the gate: the full loop runs end-to-end with no manual step between the swap and the hedge.
Show me the test output and the deploy/run commands.
```

### Phase 3 — Harden

```
Phase 3: FR-11 funding/refund flow on the RSC; idempotent/reversible hedge updates and a short
note on reorg handling; fork tests for the hook against Unichain Sepolia (NFR-4, NFR-5). Make the
repo build clean from a fresh clone. Don't add features — only robustness and tests.
```

### Phase 4 — Frontend

```
Phase 4: a single-page Next.js + viem + wagmi dashboard (FR-22-24). No backend. Panels: LP/pool
position, RSC cumulative drift, destination hedge position, and a live event feed of
SwapObserved / Callback / HedgeExecuted. Add a "push external price" demo control (FR-23) that
triggers the chain for the live demo, and a link to the Reactscan callback tx (FR-24). Match the
visual language of ARCHITECTURE.html (Space Grotesk + IBM Plex Mono, per-chain colors:
origin #FF5CAA, reactive #38E1FF, dest #FFB454). Keep it calm; the live feed is the star.
```

### Phase 5 — Backtest + the headline number

```
Phase 5 (FR-25): a script that replays historical ETH/USDC price moves and reports impermanent loss
WITH vs WITHOUT ReactiveHedge against an unhedged baseline, using DeltaMath.impermanentLoss. Output
one clean headline figure ("reduces IL by X% over [period]") and a small chart I can screenshot for
the demo. State every assumption.
```

---

## Tips for driving Claude Code on this build

- **Make it plan before it writes.** Every phase prompt above asks for a plan first. Read it,
  correct course, then say "go." This is where you catch a wrong reactive-lib API or a flag mismatch
  before it costs an hour.
- **One phase per session/branch.** Commit at each green gate. If a phase goes sideways, you can
  reset to the last gate instead of untangling.
- **Point it at lib source, not memory.** The single highest-leverage instruction is "read the
  installed reactive-lib / v4-periphery source and use the real API." It prevents the most common
  failure mode (plausible-but-wrong function names).
- **Hold the gates.** Don't let it move past the Day-3 rails gate or the Day-6 loop gate on vibes —
  require the Reactscan tx and the hands-free run respectively. The fallback exists for a reason.
- **You run the deploys.** Let Claude Code write scripts and hand you exact commands, but execute
  deploys and fund transactions yourself so secrets stay in your `.env` and out of the agent loop.
