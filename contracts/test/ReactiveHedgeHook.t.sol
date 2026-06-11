// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ReactiveHedgeHook} from "../src/hooks/ReactiveHedgeHook.sol";
import {HookMiner} from "./utils/HookMiner.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

/// @notice Tests the hook's permission flags + HookMiner round-trip (FR-1, FR-20).
contract ReactiveHedgeHookTest is Test {
    // afterAddLiquidity | afterRemoveLiquidity | afterSwap
    uint160 internal constant EXPECTED_FLAGS =
        Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG;

    IPoolManager internal poolManager = IPoolManager(makeAddr("poolManager"));
    address internal callbackProxy = makeAddr("callbackProxy");
    address internal rvmId = makeAddr("rvmId");

    ReactiveHedgeHook internal hook;

    function setUp() public {
        bytes memory args = abi.encode(poolManager, callbackProxy, rvmId);
        (address mined, bytes32 salt) =
            HookMiner.find(address(this), EXPECTED_FLAGS, type(ReactiveHedgeHook).creationCode, args);

        hook = new ReactiveHedgeHook{salt: salt}(poolManager, callbackProxy, rvmId);
        // FR-20: the deployed address must equal the mined one.
        assertEq(address(hook), mined, "deployed != mined");
    }

    function test_PermissionsMatchAddressFlags() public view {
        // The low 14 bits of the address encode exactly the enabled flags.
        assertEq(uint160(address(hook)) & HookMiner.FLAG_MASK, EXPECTED_FLAGS, "flag bits mismatch");

        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.afterAddLiquidity);
        assertTrue(p.afterRemoveLiquidity);
        assertTrue(p.afterSwap);
        assertFalse(p.beforeSwap);
        assertFalse(p.beforeAddLiquidity);
    }

    function test_AuthConfig() public view {
        assertEq(hook.callbackProxy(), callbackProxy);
        assertEq(hook.authorizedRvmId(), rvmId);
        assertEq(address(hook.poolManager()), address(poolManager));
    }

    function test_RevertWhen_RebalanceNotFromProxy() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(ReactiveHedgeHook.NotCallbackProxy.selector);
        hook.onReactiveRebalance(rvmId, keccak256("p"), 1e18);
    }

    function test_RevertWhen_RebalanceWrongRvm() public {
        vm.prank(callbackProxy);
        vm.expectRevert(ReactiveHedgeHook.UnauthorizedRvm.selector);
        hook.onReactiveRebalance(makeAddr("notRvm"), keccak256("p"), 1e18);
    }
}
