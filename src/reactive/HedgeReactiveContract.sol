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

    /// @notice Running cumulative drift accumulated in the ReactVM.
    uint256 public cumulativeDrift;

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
    /// @dev Phase 1 fires a callback on any SwapObserved to prove the rails;
    ///      Phase 2 will accumulate drift and only fire past {driftThreshold}.
    function react(LogRecord calldata log) external vmOnly {
        // SwapObserved(bytes32 indexed poolId, int256 amount0, int256 amount1, uint160 sqrtPriceX96)
        bytes32 poolId = bytes32(log.topic_1);

        // Phase 1: a fixed dummy hedge delta — Phase 2 replaces this with a
        // delta derived from accumulated price drift.
        int256 hedgeDelta = 1e18;

        bytes memory payload = abi.encodeWithSignature(
            "onReactiveRebalance(address,bytes32,int256)",
            address(0), // rvm id placeholder — Reactive overwrites with the real id
            poolId,
            hedgeDelta
        );
        emit Callback(destinationChainId, executor, callbackGasLimit, payload);
    }
}
