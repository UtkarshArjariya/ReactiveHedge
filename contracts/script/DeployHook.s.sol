// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ReactiveHedgeHook} from "../src/hooks/ReactiveHedgeHook.sol";
import {HookMiner} from "../test/utils/HookMiner.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

/// @notice Step 2 of the build order — deploy ReactiveHedgeHook to Unichain Sepolia.
/// @dev Mines a CREATE2 salt so the address encodes the FR-1 flags, then asserts
///      `deployed == mined` (FR-20, hard rule #1). The authorized RVM id starts as
///      the deployer EOA and is updated via setAuthorizedRvmId once the RSC is live.
///      Run: forge script script/DeployHook.s.sol --rpc-url unichain_sepolia --broadcast
contract DeployHook is Script {
    /// @dev Canonical deterministic CREATE2 factory (same on every chain).
    address internal constant DEFAULT_CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (ReactiveHedgeHook hook) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER_UNICHAIN_SEPOLIA"));
        address proxy = vm.envAddress("CALLBACK_PROXY_UNICHAIN_SEPOLIA");
        address create2 = vm.envOr("CREATE2_DEPLOYER", DEFAULT_CREATE2_DEPLOYER);

        // Authorized RVM id == the EOA that will deploy the RSC (this deployer).
        address authorizedRvmId = vm.envOr("AUTHORIZED_RVM_ID", deployer);

        uint160 flags =
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG;
        bytes memory args = abi.encode(poolManager, proxy, authorizedRvmId);
        (address mined, bytes32 salt) =
            HookMiner.find(create2, flags, type(ReactiveHedgeHook).creationCode, args);

        vm.startBroadcast(pk);
        hook = new ReactiveHedgeHook{salt: salt}(poolManager, proxy, authorizedRvmId);
        vm.stopBroadcast();

        require(address(hook) == mined, "DeployHook: deployed != mined");

        console2.log("ReactiveHedgeHook deployed at:", address(hook));
        console2.log("  flags (low 14 bits):", uint256(uint160(address(hook)) & HookMiner.FLAG_MASK));
        console2.log("  authorized RVM id:", authorizedRvmId);
        console2.log("  -> set HOOK_ADDRESS in .env to the address above");
    }
}
