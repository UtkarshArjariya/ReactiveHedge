<!--
  FILE LOCATION: ./contracts/AGENTS.md
  Precedence: applies to everything under ./contracts. Root ../AGENTS.md still
  applies for project-wide context; this refines it for Solidity work.
  This is a SELF-CONTAINED Foundry project — run forge from HERE, not the repo root.
-->

# AGENTS.md — contracts/ (Solidity + Foundry)

Self-contained Foundry project for ReactiveHedge's three contracts. Read root `../AGENTS.md` first for
the architecture, data flow, and hard rules. **Run `forge` from this directory, with its own
`contracts/.env` — never from the repo root.**

## Commands

```bash
export PATH="$HOME/.foundry/bin:$PATH"        # forge/cast aren't on the default PATH
forge build
forge test -vvv                               # verbose on failure
forge test --match-path test/HedgeReactiveContract.t.sol   # file-scoped (preferred while iterating)
forge test --match-test test_DriftFiresCallback
forge coverage                                # before declaring "done" on core logic
forge fmt                                      # formatter of record — run before every commit
forge snapshot                                 # gas; commit when gas shifts
aderyn .                                        # Solidity static analysis (config: ../aderyn.toml)
```

Config: Solidity **0.8.26**, `evm_version = cancun`, `via_ir = true`. Fork/deploy needs keys in
`contracts/.env` (gitignored) — use a **fresh dev wallet only**. Keep a `.env.example` listing every key.

## Contract inventory

| Contract / file                              | Chain (testnet)      | Role                                                        |
|----------------------------------------------|----------------------|------------------------------------------------------------|
| `src/hooks/ReactiveHedgeHook.sol`            | Unichain Sepolia 1301| v4 hook: per-LP delta, emits `SwapObserved`, takes callbacks |
| `src/reactive/HedgeReactiveContract.sol`     | Reactive Lasna 5318007| RSC: subscribes to `SwapObserved`, accumulates drift, callbacks |
| `src/destination/HedgeExecutor.sol`          | Base Sepolia 84532   | validates callback, updates mock hedge, emits `HedgeExecuted` |
| `src/libraries/DeltaMath.sol`                | —                    | pure IL/delta math (known-answer tested)                   |
| `src/base/BaseHook.sol`                       | —                    | vendored v4 hook base (periphery removed it)               |
| `test/utils/HookMiner.sol` (vendored)         | —                    | CREATE2 salt mining for hook flags                         |

## Dependencies (forge submodules under contracts/lib/)

- `v4-core` pinned **v4.0.0** — the only Uniswap source imported.
- `v4-periphery` installed for fidelity but **nothing imports from it** (BaseHook is vendored instead).
- `reactive-lib` — RSC base / `AbstractPayer` / callback interfaces. **The installed lib source wins
  over the docs** when they disagree.
- `remappings.txt` exists at repo root for editor resolution; **it must contain no comment lines**
  (forge errors). The real remappings forge uses live in this project.

## Uniswap v4 hook rules

- Declare callbacks in `getHookPermissions()`; the address bits MUST encode them. The deploy script
  mines a CREATE2 salt with `HookMiner` so the deployed address matches.
  **`getHookPermissions()` and the `HookMiner.find()` flags must stay in sync** or deploy reverts with
  `HookAddressNotValid` (hard rule #1).
- CREATE2 deployer: `0x4e59b44847b379578588920cA78FbF26c0B4956C`.
- Hot-path discipline: keep `SwapObserved` emission cheap; no unbounded loops in swap callbacks.
- Foundry **stable**, not nightly.

## Reactive Network rules (the part that silently breaks)

- Extend the `reactive-lib` base; implement `react()` for `HedgeReactiveContract`.
- **Dual identity (hard rule #3):** the RSC runs both as a Reactive Network instance and as a ReactVM
  instance. Guard subscription setup with `if (!vm)`, guard `react()` with `vmOnly`, and **never call
  `subscribe` from inside the VM**.
- **Authenticate every callback (hard rule #2):** `HedgeExecutor.onReactiveRebalance()` must
  `require(msg.sender == CALLBACK_PROXY)` AND `require(rvmId == AUTHORIZED_RVM_ID)`. Store both immutably.
- **Subscriptions are coupled to event shape:** the RSC subscribes to the hook's `SwapObserved`
  `(chainId, contract, topic0)`. If you rename/reshape `SwapObserved`, update the subscription or
  reactions stop firing.
- **Callback gas (hard rule #5):** min 100k (lower silently ignored), max 900k, budget 200k–300k.
- **Fund the RSC (hard rule #6):** it pays for its own callbacks via `AbstractPayer`/`depositTo`; send
  REACT after deploy or it gets blocklisted.
- **Idempotency (hard rule #7):** reorgs can invalidate sent callbacks (no finality wait) — make hedge
  state updates idempotent.
- **No mainnet/testnet mixing.** System contract (mainnet + Lasna): `0x…00fffFfF`.

## Style & testing bar

- Custom errors, full NatSpec, events on every observable state change (the hook events ARE the RSC API).
- Tests (~30, keep green): unit per contract + **integration on a local `PoolManager`** + **fork tests**
  per chain leg + at least one end-to-end `SwapObserved → react() → callback → HedgeExecuted` path.
  Known-answer tests for `DeltaMath`. Fuzz the drift/threshold logic.
- Run `forge fmt` + the file-scoped tests before finishing any task.

## Deploy order (testnet)

1. Deploy `HedgeExecutor` on Base Sepolia; record its address + the Base `CALLBACK_PROXY` + `AUTHORIZED_RVM_ID`.
2. Deploy `ReactiveHedgeHook` on Unichain Sepolia via salt-mined CREATE2; create the ETH/USDC pool; add liquidity.
3. Deploy `HedgeReactiveContract` on Reactive Lasna pointing at the hook (origin) + executor (destination); **fund it with REACT**.
4. Verify each contract; smoke-test one full `SwapObserved → HedgeExecuted` round trip before demoing.

## Backtest

`backtest/` produces `results.csv` (the IL **2.02% → 0.14%, ~93% reduction** headline on a 30-day
ETH/USDC run). The app serves it via `/api/backtest`. If you change the math, regenerate the CSV and
keep the headline numbers and the dashboard in sync.
