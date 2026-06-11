// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {TestERC20} from "v4-core/src/test/TestERC20.sol";

/// @notice Step 5 of the build order — initialize a pool keyed to the hook and
///         seed full-range liquidity so a swap can be triggered (FR-21).
/// @dev Deploys two mock tokens (mock WETH / USDC) and a modify-liquidity router
///      for the demo. The pool price starts at 1:1. After running, set
///      POOL_CURRENCY0 / POOL_CURRENCY1 / LIQUIDITY_ROUTER in .env for Swap.s.sol.
///      Run: forge script script/CreatePoolAndAddLiquidity.s.sol --rpc-url unichain_sepolia --broadcast
contract CreatePoolAndAddLiquidity is Script {
    /// @dev sqrt(1) in Q64.96 — a 1:1 starting price.
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 internal constant FEE = 3000; // 0.30%
    int24 internal constant TICK_SPACING = 60;
    // Full-range usable ticks for tickSpacing 60.
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER_UNICHAIN_SEPOLIA"));
        IHooks hook = IHooks(vm.envAddress("HOOK_ADDRESS"));

        vm.startBroadcast(pk);

        // 1) Mock tokens (minted to the deployer by the TestERC20 constructor).
        TestERC20 tokenA = new TestERC20(1_000_000 ether);
        TestERC20 tokenB = new TestERC20(1_000_000 ether);

        // 2) Sort so currency0 < currency1 (a v4 PoolKey invariant).
        (Currency currency0, Currency currency1) = address(tokenA) < address(tokenB)
            ? (Currency.wrap(address(tokenA)), Currency.wrap(address(tokenB)))
            : (Currency.wrap(address(tokenB)), Currency.wrap(address(tokenA)));

        // 3) Liquidity router + approvals.
        PoolModifyLiquidityTest router = new PoolModifyLiquidityTest(poolManager);
        TestERC20(Currency.unwrap(currency0)).approve(address(router), type(uint256).max);
        TestERC20(Currency.unwrap(currency1)).approve(address(router), type(uint256).max);

        // 4) Initialize the pool keyed to our hook.
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // 5) Seed full-range liquidity (fires afterAddLiquidity on the hook).
        router.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: 1_000 ether,
                salt: bytes32(0)
            }),
            ""
        );

        vm.stopBroadcast();

        console2.log("Pool initialized + seeded.");
        console2.log("  currency0:", Currency.unwrap(currency0));
        console2.log("  currency1:", Currency.unwrap(currency1));
        console2.log("  liquidity router:", address(router));
        console2.log("  -> set POOL_CURRENCY0 / POOL_CURRENCY1 / LIQUIDITY_ROUTER in .env");
    }
}
