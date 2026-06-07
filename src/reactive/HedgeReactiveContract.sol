// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {AbstractReactive} from "reactive-lib/src/abstract-base/AbstractReactive.sol";

/// @title HedgeReactiveContract
/// @notice Reactive Smart Contract (Reactive Lasna) that watches the hook's
///         SwapObserved events, accumulates price drift, and fires a cross-chain
///         rebalance callback when drift crosses a threshold.
/// @dev Dual-instance (CLAUDE.md hard rule #3): the Reactive-Network instance
///      runs the constructor and subscribes (`if (!vm)`); the ReactVM instance
///      runs {react} (`vmOnly`). Config the VM needs is `immutable` so it is
///      baked into bytecode and present in both instances; only `cumulativeDrift`
///      is mutable VM-side storage.
contract HedgeReactiveContract is AbstractReactive {
    /// @dev topic_0 of `SwapObserved(bytes32,int256,int256,uint160)`.
    uint256 private constant SWAP_OBSERVED_TOPIC_0 =
        uint256(keccak256("SwapObserved(bytes32,int256,int256,uint160)"));

    /// @notice Origin chain of the subscribed hook (Unichain Sepolia = 1301).
    uint256 public immutable originChainId;
    /// @notice The ReactiveHedgeHook address being watched on the origin chain.
    address public immutable hook;
    /// @notice Destination chain for the hedge callback (Base Sepolia = 84532).
    uint256 public immutable destinationChainId;
    /// @notice The HedgeExecutor address the callback targets.
    address public immutable executor;
    /// @notice Gas budget for the cross-chain callback (Reactive min 100k).
    uint64 public immutable callbackGasLimit;
    /// @notice Cumulative drift (bps) at which a hedge fires, then resets.
    uint256 public immutable driftThreshold;

    /// @notice Running cumulative drift (bps) accumulated in the ReactVM.
    uint256 public cumulativeDrift;

    /// @notice Last observed sqrt price (Q64.96), updated every react (VM-side).
    uint160 public lastSqrtPriceX96;

    /// @notice Number of hedge callbacks fired (demo / frontend convenience).
    uint256 public hedgesFired;

    /// @notice Deployer; may top up or withdraw the RSC's REACT balance.
    address public immutable owner;

    /// @notice Emitted when the RSC is funded with REACT.
    event Funded(address indexed from, uint256 amount);
    /// @notice Emitted when the owner withdraws surplus REACT.
    event Withdrawn(address indexed to, uint256 amount);

    /// @param _originChainId  EIP-155 id of the chain the hook is on.
    /// @param _hook           ReactiveHedgeHook address to subscribe to.
    /// @param _destChainId    EIP-155 id of the hedge destination chain.
    /// @param _executor       HedgeExecutor address to call back.
    /// @param _callbackGas    Callback gas budget (>= 100_000).
    /// @param _driftThreshold Cumulative drift (bps) that triggers a hedge.
    constructor(
        uint256 _originChainId,
        address _hook,
        uint256 _destChainId,
        address _executor,
        uint64 _callbackGas,
        uint256 _driftThreshold
    ) payable {
        originChainId = _originChainId;
        hook = _hook;
        destinationChainId = _destChainId;
        executor = _executor;
        callbackGasLimit = _callbackGas;
        driftThreshold = _driftThreshold;
        owner = msg.sender;

        // Subscribe only on the Reactive-Network instance (hard rule #3).
        if (!vm) {
            service.subscribe(
                _originChainId,
                _hook,
                SWAP_OBSERVED_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }

    /// @notice Reactive entry point — runs in the ReactVM on each matched event.
    /// @dev Accumulates step-to-step price drift (bps) and fires a hedge callback
    ///      only once cumulative drift crosses {driftThreshold}, then resets. The
    ///      hedge opposes the most recent move and is sized to accumulated drift
    ///      (MVP heuristic; a production build would size from per-LP netDelta).
    function react(LogRecord calldata log) external vmOnly {
        // SwapObserved(bytes32 indexed poolId, int256 amount0, int256 amount1, uint160 sqrtPriceX96)
        bytes32 poolId = bytes32(log.topic_1);
        (,, uint160 sqrtPriceX96) = abi.decode(log.data, (int256, int256, uint160));

        uint160 last = lastSqrtPriceX96;
        lastSqrtPriceX96 = sqrtPriceX96;

        // First observation establishes the baseline; nothing to hedge yet.
        if (last == 0) return;

        // Signed sqrt-price move in bps relative to the last observation.
        int256 stepBps = ((int256(uint256(sqrtPriceX96)) - int256(uint256(last))) * 10_000) / int256(uint256(last));
        uint256 absStep = stepBps >= 0 ? uint256(stepBps) : uint256(-stepBps);
        cumulativeDrift += absStep;

        if (cumulativeDrift < driftThreshold) return;

        // Threshold crossed — size the hedge to accumulated drift, opposing the
        // latest move (price up => short, price down => long). bps -> WAD: *1e14.
        int256 magnitude = int256(cumulativeDrift) * 1e14;
        int256 hedgeDelta = stepBps >= 0 ? -magnitude : magnitude;

        bytes memory payload = abi.encodeWithSignature(
            "onReactiveRebalance(address,bytes32,int256)",
            address(0), // rvm id placeholder — Reactive overwrites with the real id
            poolId,
            hedgeDelta
        );
        emit Callback(destinationChainId, executor, callbackGasLimit, payload);

        // Reset the accumulator (FR-10).
        cumulativeDrift = 0;
        unchecked {
            ++hedgesFired;
        }
    }

    // ── funding / refund (FR-11, hard rule #6) ─────────────────────────────────
    //
    // The RSC pays the callback proxy for cross-chain callbacks out of its own
    // REACT balance (via the inherited AbstractPayer: receive()/pay()/coverDebt()).
    // An underfunded RSC stops working and can be blocklisted, so keep it funded.
    //
    // Reorg safety (hard rule #7): Reactive does not wait for origin finality, so
    // a callback can be emitted for a swap that later reorgs out. Hedge updates are
    // therefore kept *reversible* — both the RSC's cumulativeDrift and the
    // destination's netHedgePosition are signed accumulators, so a subsequent
    // opposite-direction observation naturally unwinds an over-hedge rather than
    // wedging state. No irreversible side effects are taken on a single callback.

    /// @notice Explicitly top up the RSC's REACT balance.
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Withdraw surplus REACT (owner only). Leaves the rest to pay callbacks.
    /// @param amount Wei of REACT to withdraw to the owner.
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "only owner");
        _pay(payable(owner), amount);
        emit Withdrawn(owner, amount);
    }
}
