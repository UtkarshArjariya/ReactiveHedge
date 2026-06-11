// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AbstractCallback} from "reactive-lib/src/abstract-base/AbstractCallback.sol";
import {IHedgeExecutor} from "../interfaces/IHedgeExecutor.sol";

/// @title HedgeExecutor
/// @notice Destination-chain (Base Sepolia) hedge venue. Receives validated
///         Reactive callbacks and updates a mock hedge position.
/// @dev Auth model (CLAUDE.md hard rule #2) is provided by {AbstractCallback}:
///      - `authorizedSenderOnly` ⇒ only the configured callback proxy may call.
///      - `rvmIdOnly(rvmId)`     ⇒ only the authorized RVM id may trigger.
///      The mock state update is the post-MVP seam for a real perp order (FR-15).
contract HedgeExecutor is AbstractCallback, IHedgeExecutor {
    /// @inheritdoc IHedgeExecutor
    int256 public netHedgePosition;

    /// @notice Block number of the most recently applied rebalance.
    uint256 public lastHedgeBlock;

    /// @notice Number of rebalances applied (demo / frontend convenience).
    uint256 public hedgeCount;

    /// @param _callbackProxy Reactive callback proxy on this chain (Base Sepolia).
    /// @dev Constructor is payable so the deployer can pre-fund the contract.
    constructor(address _callbackProxy) payable AbstractCallback(_callbackProxy) {}

    /// @inheritdoc IHedgeExecutor
    function onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta)
        external
        override
        authorizedSenderOnly
        rvmIdOnly(rvmId)
    {
        // ── post-MVP seam (FR-15) ────────────────────────────────────────────
        // A live integration would translate `hedgeDelta` into a perp order on
        // Hyperliquid / a GMX-style venue here. The MVP records intent only.
        netHedgePosition += hedgeDelta;
        lastHedgeBlock = block.number;
        unchecked {
            ++hedgeCount;
        }
        emit HedgeExecuted(rvmId, poolId, hedgeDelta, netHedgePosition);
    }
}
