// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IHedgeExecutor
/// @notice Destination-chain hedge venue that receives validated Reactive callbacks.
/// @dev The RSC encodes a call to {onReactiveRebalance}; the Reactive callback proxy
///      delivers it cross-chain, injecting the originating RVM id as the first arg.
interface IHedgeExecutor {
    /// @notice Emitted on every successfully applied rebalance — the demo hero event.
    /// @param rvmId The Reactive VM id that triggered the callback (the authorized RSC).
    /// @param poolId The Uniswap v4 pool the hedge corresponds to.
    /// @param deltaApplied The signed hedge adjustment applied this callback.
    /// @param newPosition The net hedge position after applying the delta.
    event HedgeExecuted(address indexed rvmId, bytes32 indexed poolId, int256 deltaApplied, int256 newPosition);

    /// @notice Reactive callback entry point. Updates the (mock) hedge position.
    /// @dev MUST validate `msg.sender == callback proxy` and `rvmId == authorized id`.
    /// @param rvmId Reactive-injected originating RVM id (first arg, overwritten by Reactive).
    /// @param poolId The pool whose exposure is being hedged.
    /// @param hedgeDelta The signed hedge adjustment to apply.
    function onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta) external;

    /// @notice Current net hedge position (mock perp notional, signed).
    function netHedgePosition() external view returns (int256);
}
