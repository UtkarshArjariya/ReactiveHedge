// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
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

/// @notice Fork test of the hook against the real Unichain Sepolia PoolManager
///         (NFR-4/5). Tagged to skip offline: if UNICHAIN_SEPOLIA_RPC_URL is
///         unset it calls vm.skip(true) so CI without network stays green.
/// @dev Deploys the hook via the canonical CREATE2 factory (present on the fork),
///      then exercises initialize + add liquidity + swap exactly as on testnet.
contract ForkHookTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_1_1 = 79228162514264337593543950336;
    address internal constant CREATE2 = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    bool internal active;
    IPoolManager internal manager;
    ReactiveHedgeHook internal hook;
    PoolModifyLiquidityTest internal lpRouter;
    PoolSwapTest internal swapRouter;
    PoolKey internal key;
    PoolId internal id;

    function setUp() public {
        string memory rpc = vm.envOr("UNICHAIN_SEPOLIA_RPC_URL", string(""));
        address pm = vm.envOr("POOL_MANAGER_UNICHAIN_SEPOLIA", address(0));
        if (bytes(rpc).length == 0 || pm == address(0)) {
            active = false;
            return;
        }
        active = true;
        vm.createSelectFork(rpc);
        manager = IPoolManager(pm);

        uint160 flags =
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG;
        bytes memory args = abi.encode(manager, makeAddr("proxy"), makeAddr("rvm"));
        (address mined, bytes32 salt) = HookMiner.find(CREATE2, flags, type(ReactiveHedgeHook).creationCode, args);
        hook = new ReactiveHedgeHook{salt: salt}(manager, makeAddr("proxy"), makeAddr("rvm"));
        require(address(hook) == mined, "fork: deployed != mined");

        lpRouter = new PoolModifyLiquidityTest(manager);
        swapRouter = new PoolSwapTest(manager);

        TestERC20 a = new TestERC20(1_000_000 ether);
        TestERC20 b = new TestERC20(1_000_000 ether);
        (Currency c0, Currency c1) = address(a) < address(b)
            ? (Currency.wrap(address(a)), Currency.wrap(address(b)))
            : (Currency.wrap(address(b)), Currency.wrap(address(a)));
        TestERC20(Currency.unwrap(c0)).approve(address(lpRouter), type(uint256).max);
        TestERC20(Currency.unwrap(c1)).approve(address(lpRouter), type(uint256).max);
        TestERC20(Currency.unwrap(c0)).approve(address(swapRouter), type(uint256).max);

        key = PoolKey({currency0: c0, currency1: c1, fee: 3000, tickSpacing: 60, hooks: IHooks(address(hook))});
        id = key.toId();
        manager.initialize(key, SQRT_1_1);
        lpRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 1_000 ether, salt: bytes32(0)}),
            ""
        );
    }

    function test_Fork_SwapEmitsSwapObserved() public {
        if (!active) {
            vm.skip(true);
            return;
        }
        vm.expectEmit(true, false, false, false);
        emit IReactiveHedgeHook.SwapObserved(PoolId.unwrap(id), 0, 0, 0);
        swapRouter.swap(
            key,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }
}
