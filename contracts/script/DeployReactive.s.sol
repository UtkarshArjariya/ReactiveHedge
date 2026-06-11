// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {HedgeReactiveContract} from "../src/reactive/HedgeReactiveContract.sol";

/// @notice Step 3 of the build order — deploy the RSC to Reactive Lasna.
/// @dev Needs the hook (origin) + executor (destination) addresses. Sends an
///      initial REACT funding value so callbacks are paid for (hard rule #6).
///      Run: forge script script/DeployReactive.s.sol --rpc-url reactive_lasna --broadcast
contract DeployReactive is Script {
    uint256 internal constant UNICHAIN_SEPOLIA = 1301;
    uint256 internal constant BASE_SEPOLIA = 84532;

    function run() external returns (HedgeReactiveContract rsc) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address hook = vm.envAddress("HOOK_ADDRESS");
        address executor = vm.envAddress("EXECUTOR_ADDRESS");
        uint64 callbackGas = uint64(vm.envOr("CALLBACK_GAS_LIMIT", uint256(250_000)));
        uint256 driftThreshold = vm.envOr("DRIFT_THRESHOLD_BPS", uint256(50));
        uint256 fund = vm.envOr("RSC_FUNDING_WEI", uint256(0));

        vm.startBroadcast(pk);
        rsc = new HedgeReactiveContract{value: fund}(
            UNICHAIN_SEPOLIA, hook, BASE_SEPOLIA, executor, callbackGas, driftThreshold
        );
        vm.stopBroadcast();

        console2.log("HedgeReactiveContract deployed at:", address(rsc));
        console2.log("  subscribed to hook:", hook);
        console2.log("  callback target (executor):", executor);
        console2.log("  funded with (wei):", fund);
        console2.log("  -> set RSC_ADDRESS in .env; fund it with REACT if not already");
    }
}
