// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IReactiveHedgeHook
/// @notice Events and rebalance entry point of the ReactiveHedge v4 hook.
/// @dev `SwapObserved` is the primary event the RSC subscribes to. The hook can
///      also be the destination of a rebalance callback (the in-pool path), so it
///      exposes the same {onReactiveRebalance} shape as the executor.
interface IReactiveHedgeHook {
    /// @notice Emitted when an LP adds liquidity; records their net delta contribution.
    event LiquidityAdded(bytes32 indexed poolId, address indexed lp, int256 delta0, int256 delta1);

    /// @notice Emitted when an LP removes liquidity; decrements their recorded exposure.
    event LiquidityRemoved(bytes32 indexed poolId, address indexed lp, int256 delta0, int256 delta1);

    /// @notice Emitted on every swap. The RSC subscribes to this to track price drift.
    /// @param poolId The pool that was swapped against.
    /// @param amount0 Signed token0 delta of the swap (from the pool's perspective).
    /// @param amount1 Signed token1 delta of the swap.
    /// @param sqrtPriceX96 The pool price after the swap, read from the PoolManager.
    event SwapObserved(bytes32 indexed poolId, int256 amount0, int256 amount1, uint160 sqrtPriceX96);

    /// @notice Emitted when a Reactive rebalance callback is applied to in-pool hedge intent.
    event RebalanceExecuted(address indexed rvmId, bytes32 indexed poolId, int256 hedgeDelta, int256 newIntent);

    /// @notice Emitted when the owner updates the authorized RVM id (post-deploy wiring).
    event AuthorizedRvmIdUpdated(address indexed previous, address indexed current);

    /// @notice Reactive callback entry point for the in-pool rebalance path.
    /// @param rvmId Reactive-injected originating RVM id (first arg).
    /// @param poolId The pool to rebalance.
    /// @param hedgeDelta The signed hedge adjustment to record as rebalance intent.
    function onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta) external;
}
