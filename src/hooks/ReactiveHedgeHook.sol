// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "../base/BaseHook.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {IReactiveHedgeHook} from "../interfaces/IReactiveHedgeHook.sol";

/// @title ReactiveHedgeHook
/// @notice Uniswap v4 hook (Unichain Sepolia) that broadcasts price moves and
///         tracks per-LP delta exposure for cross-chain IL hedging.
/// @dev Enables exactly afterAddLiquidity / afterRemoveLiquidity / afterSwap
///      (FR-1). `getHookPermissions()` MUST match the mined CREATE2 salt — see
///      CLAUDE.md hard rule #1 and DeployHook.s.sol.
contract ReactiveHedgeHook is BaseHook, IReactiveHedgeHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using BalanceDeltaLibrary for BalanceDelta;

    /// @notice Thrown when a rebalance callback is not from the configured proxy.
    error NotCallbackProxy();
    /// @notice Thrown when a rebalance callback carries an unauthorized RVM id.
    error UnauthorizedRvm();

    /// @notice Reactive callback proxy on this chain (Unichain Sepolia).
    address public immutable callbackProxy;

    /// @notice The RVM id permitted to trigger rebalance callbacks (our RSC).
    /// @dev Mutable so the placeholder set at deploy can be updated once the RSC
    ///      is deployed and its RVM id (== RSC deployer EOA) is known.
    address public authorizedRvmId;

    /// @notice Deployer, allowed to set {authorizedRvmId} once post-deploy.
    address public immutable owner;

    /// @notice Net recorded delta intent per pool from applied rebalances.
    mapping(PoolId => int256) public hedgeIntent;

    constructor(IPoolManager _poolManager, address _callbackProxy, address _authorizedRvmId)
        BaseHook(_poolManager)
    {
        callbackProxy = _callbackProxy;
        authorizedRvmId = _authorizedRvmId;
        owner = msg.sender;
    }

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Update the authorized RVM id once the RSC is deployed.
    function setAuthorizedRvmId(address _rvmId) external {
        require(msg.sender == owner, "only owner");
        authorizedRvmId = _rvmId;
    }

    // ── hook callbacks ────────────────────────────────────────────────────────

    function _afterAddLiquidity(
        address, /*sender*/
        PoolKey calldata, /*key*/
        IPoolManager.ModifyLiquidityParams calldata, /*params*/
        BalanceDelta, /*delta*/
        BalanceDelta, /*feesAccrued*/
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, BalanceDelta) {
        // TODO(Phase 2): record per-LP net delta and emit LiquidityAdded.
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterRemoveLiquidity(
        address, /*sender*/
        PoolKey calldata, /*key*/
        IPoolManager.ModifyLiquidityParams calldata, /*params*/
        BalanceDelta, /*delta*/
        BalanceDelta, /*feesAccrued*/
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, BalanceDelta) {
        // TODO(Phase 2): decrement per-LP net delta and emit LiquidityRemoved.
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterSwap(
        address, /*sender*/
        PoolKey calldata, /*key*/
        IPoolManager.SwapParams calldata, /*params*/
        BalanceDelta, /*delta*/
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, int128) {
        // TODO(Phase 1): read sqrtPriceX96 from the PoolManager and emit SwapObserved.
        return (IHooks.afterSwap.selector, int128(0));
    }

    // ── reactive callback (in-pool rebalance path) ─────────────────────────────

    /// @inheritdoc IReactiveHedgeHook
    function onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta) external override {
        if (msg.sender != callbackProxy) revert NotCallbackProxy();
        if (rvmId != authorizedRvmId) revert UnauthorizedRvm();
        // TODO(Phase 2): apply rebalance to hedge intent and emit RebalanceExecuted.
    }
}
