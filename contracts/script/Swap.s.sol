// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {TestERC20} from "v4-core/src/test/TestERC20.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

/// @notice Step 6 of the build order — trigger a swap so the hook emits
///         SwapObserved, which the RSC reacts to and hedges cross-chain.
/// @dev This is the demo trigger. Watch Reactscan for the resulting callback.
///      Run: forge script script/Swap.s.sol --rpc-url unichain_sepolia --broadcast
contract Swap is Script {
    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER_UNICHAIN_SEPOLIA"));
        IHooks hook = IHooks(vm.envAddress("HOOK_ADDRESS"));
        Currency currency0 = Currency.wrap(vm.envAddress("POOL_CURRENCY0"));
        Currency currency1 = Currency.wrap(vm.envAddress("POOL_CURRENCY1"));
        int256 amountIn = int256(vm.envOr("SWAP_AMOUNT_IN", uint256(1 ether)));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });

        vm.startBroadcast(pk);

        PoolSwapTest swapRouter = new PoolSwapTest(poolManager);
        TestERC20(Currency.unwrap(currency0)).approve(address(swapRouter), type(uint256).max);

        // Exact-input zeroForOne swap — moves the price and fires afterSwap.
        swapRouter.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -amountIn, // negative => exact input
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        vm.stopBroadcast();

        console2.log("Swap executed. SwapObserved emitted -> watch Reactscan for the callback.");
    }
}
