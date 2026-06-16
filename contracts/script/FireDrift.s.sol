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

/// @notice DEMO DRIVER — fires a burst of alternating swaps in a single run so the
///         hook emits many SwapObserved events. The RSC (in the ReactVM) accumulates
///         |price drift| across them; once it crosses DRIFT_THRESHOLD_BPS it fires the
///         cross-chain callback and the hedge lands on Base (HedgeExecuted).
/// @dev    Alternating direction keeps the pool from draining while still piling up
///         absolute drift. Each ~1 ETH swap ≈ ~10 bps; defaults below clear 50 bps with
///         margin. Tune with env: SWAP_COUNT, SWAP_AMOUNT_IN (wei).
///         Run: forge script script/FireDrift.s.sol --rpc-url unichain_sepolia --broadcast
contract FireDrift is Script {
    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager pm = IPoolManager(vm.envAddress("POOL_MANAGER_UNICHAIN_SEPOLIA"));
        IHooks hook = IHooks(vm.envAddress("HOOK_ADDRESS"));
        Currency c0 = Currency.wrap(vm.envAddress("POOL_CURRENCY0"));
        Currency c1 = Currency.wrap(vm.envAddress("POOL_CURRENCY1"));
        uint256 count = vm.envOr("SWAP_COUNT", uint256(10));
        uint256 amount = vm.envOr("SWAP_AMOUNT_IN", uint256(3 ether));

        PoolKey memory key =
            PoolKey({currency0: c0, currency1: c1, fee: FEE, tickSpacing: TICK_SPACING, hooks: hook});

        vm.startBroadcast(pk);

        PoolSwapTest router = new PoolSwapTest(pm);
        TestERC20(Currency.unwrap(c0)).approve(address(router), type(uint256).max);
        TestERC20(Currency.unwrap(c1)).approve(address(router), type(uint256).max);

        for (uint256 i = 0; i < count; i++) {
            bool zeroForOne = (i % 2 == 0); // alternate direction → oscillate price
            router.swap(
                key,
                IPoolManager.SwapParams({
                    zeroForOne: zeroForOne,
                    amountSpecified: -int256(amount), // negative => exact input
                    sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
                ""
            );
        }

        vm.stopBroadcast();

        console2.log("Fired swaps:", count);
        console2.log("Each emitted SwapObserved -> RSC accumulates drift in the ReactVM.");
        console2.log("Watch Base executor for HedgeExecuted (netHedge flips from 0) + Reactscan for the callback.");
    }
}
