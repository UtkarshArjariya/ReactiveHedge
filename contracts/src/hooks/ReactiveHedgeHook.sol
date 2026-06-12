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
    /// @notice Thrown when a critical address argument is the zero address.
    error ZeroAddress();

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

    /// @notice Per-LP signed token0 exposure for a pool (FR-2/FR-3).
    mapping(PoolId => mapping(address => int256)) public lpExposure0;
    /// @notice Per-LP signed token1 exposure for a pool (FR-2/FR-3).
    mapping(PoolId => mapping(address => int256)) public lpExposure1;

    constructor(IPoolManager _poolManager, address _callbackProxy, address _authorizedRvmId)
        BaseHook(_poolManager)
    {
        // Proxy and the initial RVM id must be set: the deploy script seeds the RVM
        // id with the deployer EOA (a non-zero placeholder) and rewires it later via
        // {setAuthorizedRvmId}, so zero is never a legitimate value here.
        if (_callbackProxy == address(0) || _authorizedRvmId == address(0)) revert ZeroAddress();
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
    /// @dev Owner-only. Reverts on the zero address and emits {AuthorizedRvmIdUpdated}
    ///      so off-chain indexers and the frontend can track the security-critical
    ///      authorization (CLAUDE.md hard rule #2).
    function setAuthorizedRvmId(address _rvmId) external {
        require(msg.sender == owner, "only owner");
        if (_rvmId == address(0)) revert ZeroAddress();
        emit AuthorizedRvmIdUpdated(authorizedRvmId, _rvmId);
        authorizedRvmId = _rvmId;
    }

    // ── hook callbacks ────────────────────────────────────────────────────────

    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata, /*params*/
        BalanceDelta delta,
        BalanceDelta, /*feesAccrued*/
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, BalanceDelta) {
        // The caller's balance delta is negative when adding (tokens go to the
        // pool), so the position's exposure increases by the negation.
        PoolId id = key.toId();
        int256 d0 = -int256(delta.amount0());
        int256 d1 = -int256(delta.amount1());
        lpExposure0[id][sender] += d0;
        lpExposure1[id][sender] += d1;
        emit LiquidityAdded(PoolId.unwrap(id), sender, d0, d1);
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata, /*params*/
        BalanceDelta delta,
        BalanceDelta, /*feesAccrued*/
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, BalanceDelta) {
        // On removal the caller receives tokens (positive delta), so exposure
        // decreases by that amount.
        PoolId id = key.toId();
        int256 d0 = -int256(delta.amount0());
        int256 d1 = -int256(delta.amount1());
        lpExposure0[id][sender] += d0;
        lpExposure1[id][sender] += d1;
        emit LiquidityRemoved(PoolId.unwrap(id), sender, d0, d1);
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterSwap(
        address, /*sender*/
        PoolKey calldata key,
        IPoolManager.SwapParams calldata, /*params*/
        BalanceDelta delta,
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, int128) {
        PoolId id = key.toId();
        // Read the post-swap price straight from the PoolManager — this is the
        // signal the RSC subscribes to (FR-4).
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(id);
        emit SwapObserved(PoolId.unwrap(id), int256(delta.amount0()), int256(delta.amount1()), sqrtPriceX96);
        return (IHooks.afterSwap.selector, int128(0));
    }

    // ── reactive callback (in-pool rebalance path) ─────────────────────────────

    /// @inheritdoc IReactiveHedgeHook
    function onReactiveRebalance(address rvmId, bytes32 poolId, int256 hedgeDelta) external override {
        if (msg.sender != callbackProxy) revert NotCallbackProxy();
        if (rvmId != authorizedRvmId) revert UnauthorizedRvm();
        // MVP: record rebalance intent (does not move pool liquidity, FR-6).
        PoolId id = PoolId.wrap(poolId);
        int256 newIntent = hedgeIntent[id] + hedgeDelta;
        hedgeIntent[id] = newIntent;
        emit RebalanceExecuted(rvmId, poolId, hedgeDelta, newIntent);
    }
}
