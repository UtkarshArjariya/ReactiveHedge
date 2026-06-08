// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {TestERC20} from "v4-core/src/test/TestERC20.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {ReactiveHedgeHook} from "../src/hooks/ReactiveHedgeHook.sol";
import {IReactiveHedgeHook} from "../src/interfaces/IReactiveHedgeHook.sol";
import {HookMiner} from "./utils/HookMiner.sol";

/// @notice Full local integration of the hook against a real v4 PoolManager.
/// @dev Runs offline (no fork): deploys the PoolManager, mines + deploys the
///      hook, seeds liquidity, and swaps — proving afterAddLiquidity tracking
///      and SwapObserved emission against the genuine v4 engine (NFR-5).
contract IntegrationTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_1_1 = 79228162514264337593543950336;
    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    PoolManager internal manager;
    ReactiveHedgeHook internal hook;
    PoolModifyLiquidityTest internal lpRouter;
    PoolSwapTest internal swapRouter;
    PoolKey internal key;
    PoolId internal id;

    function setUp() public {
        manager = new PoolManager(address(this));

        uint160 flags =
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG;
        bytes memory args = abi.encode(IPoolManager(address(manager)), makeAddr("proxy"), makeAddr("rvm"));
        (address mined, bytes32 salt) =
            HookMiner.find(address(this), flags, type(ReactiveHedgeHook).creationCode, args);
        hook = new ReactiveHedgeHook{salt: salt}(IPoolManager(address(manager)), makeAddr("proxy"), makeAddr("rvm"));
        assertEq(address(hook), mined);

        lpRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        swapRouter = new PoolSwapTest(IPoolManager(address(manager)));

        TestERC20 a = new TestERC20(1_000_000 ether);
        TestERC20 b = new TestERC20(1_000_000 ether);
        (Currency c0, Currency c1) = address(a) < address(b)
            ? (Currency.wrap(address(a)), Currency.wrap(address(b)))
            : (Currency.wrap(address(b)), Currency.wrap(address(a)));
        TestERC20(Currency.unwrap(c0)).approve(address(lpRouter), type(uint256).max);
        TestERC20(Currency.unwrap(c1)).approve(address(lpRouter), type(uint256).max);
        TestERC20(Currency.unwrap(c0)).approve(address(swapRouter), type(uint256).max);
        TestERC20(Currency.unwrap(c1)).approve(address(swapRouter), type(uint256).max);

        key = PoolKey({currency0: c0, currency1: c1, fee: FEE, tickSpacing: TICK_SPACING, hooks: IHooks(address(hook))});
        id = key.toId();
        manager.initialize(key, SQRT_1_1);
    }

    function test_AddLiquidity_TracksExposureAndEmits() public {
        vm.expectEmit(true, false, false, false);
        emit IReactiveHedgeHook.LiquidityAdded(PoolId.unwrap(id), address(lpRouter), 0, 0);

        lpRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: 1_000 ether,
                salt: bytes32(0)
            }),
            ""
        );

        // Adding liquidity is recorded as positive exposure for the LP (router).
        assertGt(hook.lpExposure0(id, address(lpRouter)), 0, "exposure0 tracked");
        assertGt(hook.lpExposure1(id, address(lpRouter)), 0, "exposure1 tracked");
    }

    function test_Swap_EmitsSwapObserved() public {
        // Seed liquidity first so the swap has depth.
        lpRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: 1_000 ether,
                salt: bytes32(0)
            }),
            ""
        );

        vm.expectEmit(true, false, false, false);
        emit IReactiveHedgeHook.SwapObserved(PoolId.unwrap(id), 0, 0, 0);

        swapRouter.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -1 ether,
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }
}
