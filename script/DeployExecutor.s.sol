// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {HedgeExecutor} from "../src/destination/HedgeExecutor.sol";

/// @notice Step 1 of the build order — deploy HedgeExecutor to Base Sepolia.
/// @dev Reads CALLBACK_PROXY_BASE_SEPOLIA + PRIVATE_KEY from .env. No deps.
///      Run: forge script script/DeployExecutor.s.sol --rpc-url base_sepolia --broadcast
contract DeployExecutor is Script {
    function run() external returns (HedgeExecutor executor) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address proxy = vm.envAddress("CALLBACK_PROXY_BASE_SEPOLIA");

        vm.startBroadcast(pk);
        executor = new HedgeExecutor(proxy);
        vm.stopBroadcast();

        console2.log("HedgeExecutor deployed at:", address(executor));
        console2.log("  callback proxy:", proxy);
        console2.log("  -> set EXECUTOR_ADDRESS in .env to the address above");
    }
}
