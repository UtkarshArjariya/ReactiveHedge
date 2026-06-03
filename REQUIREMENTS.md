# REQUIREMENTS — ReactiveHedge

Numbered, testable requirements + a phased build plan mapped to the 10-day timeline.
Each requirement has an ID (`FR-` functional, `NFR-` non-functional, `TR-` technical) so Claude
Code can reference them in commits and tests.

---

## Functional requirements

### Hook (`ReactiveHedgeHook`, Unichain Sepolia)

- **FR-1** The hook enables exactly these callbacks: `afterAddLiquidity`, `afterRemoveLiquidity`,
  `afterSwap`. `getHookPermissions()` returns these and the deploy salt is mined to match.
- **FR-2** On `afterAddLiquidity`, the hook records the LP's net delta exposure for the pool and
  emits `LiquidityAdded(poolId, lp, delta0, delta1)`.
- **FR-3** On `afterRemoveLiquidity`, the hook decrements the LP's recorded exposure and emits
  `LiquidityRemoved(poolId, lp, delta0, delta1)`.
- **FR-4** On `afterSwap`, the hook emits `SwapObserved(poolId, amount0, amount1, sqrtPriceX96)`
  reading the current price from the PoolManager. This is the primary event the RSC subscribes to.
- **FR-5** The hook exposes `onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta)`
  callable only by the Reactive callback proxy and only for the authorized RVM id (see FR-13).
- **FR-6** `onReactiveRebalance` applies the rebalance (MVP: update internal hedge-intent state and
  emit `RebalanceExecuted`; it does not need to move pool liquidity in the MVP).

### Reactive contract (`HedgeReactiveContract`, Reactive Lasna)

- **FR-7** On deployment (Reactive Network instance only, guarded `if (!vm)`), the RSC subscribes to
  `SwapObserved` events from the hook on the origin chain.
- **FR-8 (optional / stretch)** The RSC also subscribes to a Pyth/oracle price-update event on a
  second origin chain (Base Sepolia) as an independent drift signal.
- **FR-9** `react(LogRecord)` decodes the event, updates cumulative price drift, and is guarded
  `vmOnly`.
- **FR-10** When cumulative drift exceeds `driftThreshold`, the RSC emits a `Callback` targeting the
  destination contract's `onReactiveRebalance`, with the hedge delta and pool id encoded, gas
  budget ≥ 100,000, then resets the accumulator.
- **FR-11** The RSC is fundable and uses the `AbstractPayer` pattern so callbacks are paid for.
- **FR-12** `driftThreshold` is set at construction and (stretch) updatable via an authorized path.

### Destination (`HedgeExecutor`, Base Sepolia)

- **FR-13** `onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta)` requires
  `msg.sender == CALLBACK_PROXY` and `rvmId == AUTHORIZED_RVM_ID`; otherwise it reverts.
- **FR-14** On a valid callback it updates `netHedgePosition`, records `lastHedgeBlock`, and emits
  `HedgeExecuted(rvmId, poolId, deltaApplied, newPosition)` — the demo hero event.
- **FR-15 (post-MVP placeholder)** A clearly-marked seam where a real perp order (Hyperliquid /
  GMX-style) would replace the mock state update.

### Math (`DeltaMath`, pure library)

- **FR-16** `netDelta(...)` computes an LP position's signed delta exposure from `tickLower`,
  `tickUpper`, current `sqrtPriceX96`, and `liquidity`. MVP may assume full-range to simplify.
- **FR-17** `hedgeSize(netDelta, priceMove)` returns the hedge adjustment for a given price move.
- **FR-18** `impermanentLoss(priceRatio)` returns IL for a constant-product position vs. HODL,
  used by the backtest.

### Scripts

- **FR-19** One deploy script per contract, parameterized entirely from `.env`, each printing the
  deployed address.
- **FR-20** `DeployHook` mines a CREATE2 salt with `HookMiner` so the address encodes FR-1's flags;
  it asserts `deployed == mined`.
- **FR-21** `CreatePoolAndAddLiquidity` initializes a pool keyed to the hook and seeds test
  liquidity, so a swap can be triggered for the demo.

### Frontend (Phase 4)

- **FR-22** A single page showing: (a) pool + LP position, (b) RSC cumulative drift, (c) destination
  hedge position, (d) a live feed of `SwapObserved` / `Callback` / `HedgeExecuted` events.
- **FR-23** A "push external price" demo control that triggers the event chain for the live demo.
- **FR-24** An embedded or linked Reactscan view of the callback transaction.

### Backtest (Phase 5)

- **FR-25** A script that replays historical ETH/USDC price moves and reports IL with vs. without
  ReactiveHedge, producing the single headline number for the demo.

---

## Non-functional requirements

- **NFR-1** All three contracts deploy to their testnets and the full loop runs without manual
  intervention between swap and hedge.
- **NFR-2** Every cross-chain callback entry point validates sender + RVM id (no spoofing).
- **NFR-3** End-to-end origin→destination latency is acceptable for a live demo (target < 30s).
- **NFR-4** Repo builds clean from a fresh clone with `forge build` after submodule init.
- **NFR-5** Core math has known-answer unit tests; auth paths have revert tests.
- **NFR-6** No secrets in git; fresh dev wallet only; testnet only until a final optional mainnet step.
- **NFR-7** README lets a stranger reproduce the demo.

---

## Technical requirements

- **TR-1** Foundry stable; Solidity 0.8.26; `evm_version = cancun`; `via_ir = true`.
- **TR-2** v4-core / v4-periphery / reactive-lib as submodules; remappings configured.
- **TR-3** Hook inherits `BaseHook`; flags wired per FR-1.
- **TR-4** RSC inherits the Reactive abstract base(s); subscriptions via the System Contract;
  dual-instance pattern respected (`if (!vm)` for subscribe, `vmOnly` for `react`).
- **TR-5** Callback payloads ABI-encode the destination function with the RVM-id address as the
  first parameter (Reactive overwrites it with the real id).
- **TR-6** All movable addresses read from `.env`; verified against official docs before deploy.

---

## Phased build plan (10-day, solo)

> Each phase ends in a committable green state. Gates are hard stop/descope decision points.

### Phase 0 — Scaffold (Day 1)
- Init from `uniswapfoundation/v4-template`; install `reactive-lib`; `forge build` passes.
- Drop in skeleton contracts; build still passes; template tests still pass.
- Fund a fresh wallet on all three faucets.
- Deploy `HedgeExecutor` to Base Sepolia (simplest, no mining).
- **Exit:** all three skeleton contracts compile; executor deployed; addresses in `.env`.

### Phase 1 — Prove the rails (Days 2–3) — **GATE**
- Implement `SwapObserved` emission in the hook (FR-4); deploy hook to Unichain Sepolia (FR-20).
- Implement RSC subscription + minimal `react()` that fires a callback on any event (FR-7, FR-9, FR-10).
- Deploy + fund RSC on Lasna. Trigger a swap on Unichain.
- **GATE (end Day 3):** Reactscan shows a callback, fired by the subscribed `SwapObserved` event,
  landing on `HedgeExecutor`. If not met → switch to the **ReactiveDynamicFee** fallback (PRD §9).

### Phase 2 — Real hedge logic (Days 4–6) — **GATE**
- `DeltaMath` with KA unit tests (FR-16–18).
- Real drift accumulation + threshold in the RSC (FR-9, FR-10, FR-12).
- Real delta tracking in the hook (FR-2, FR-3); `onReactiveRebalance` applies state (FR-5, FR-6).
- Enforce auth on all callbacks with revert tests (FR-13, NFR-2).
- (Stretch) second subscription to a Pyth feed on Base (FR-8).
- **GATE (end Day 6):** end-to-end loop runs with no manual step between swap and hedge (NFR-1).

### Phase 3 — Harden (Day 6–7)
- Funding/refund flows (FR-11); reorg-safety note; idempotent hedge updates.
- Fork tests for the hook against Unichain Sepolia (NFR-4, NFR-5).

### Phase 4 — Frontend (Day 7)
- Next.js dashboard (FR-22), demo control (FR-23), Reactscan link (FR-24).

### Phase 5 — Backtest + number (Day 8)
- Backtest script (FR-25); produce the headline IL-reduction figure.

### Phase 6 — Demo polish (Days 8–9)
- Script + rehearse the 3-minute narrative; capture the 60-second hero clip.
- README + architecture diagram; (optional) mainnet flex deploy.

### Phase 7 — Ship (Day 10)
- Final video, social thread tagging the relevant accounts, submission package.

---

## Traceability quick-map

| Phase | Primary FRs | Gate |
|---|---|---|
| 0 | FR-19, FR-13(stub) | compile + executor live |
| 1 | FR-4, FR-7, FR-9, FR-10, FR-20 | callback round-trip on Reactscan |
| 2 | FR-2/3/5/6, FR-9/10/12, FR-16–18, FR-13 | hands-free end-to-end loop |
| 3 | FR-11, NFR-4/5 | green fork tests |
| 4 | FR-22–24 | dashboard shows live event |
| 5 | FR-25 | headline number |
| 6–7 | NFR-7 | hero clip + submission |
