// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {HedgeExecutor} from "../src/destination/HedgeExecutor.sol";
import {IHedgeExecutor} from "../src/interfaces/IHedgeExecutor.sol";

/// @notice Tests for the destination contract incl. the callback auth paths
///         (FR-13, FR-14, NFR-2).
/// @dev AbstractCallback sets the authorized rvm_id to the deployer (this test
///      contract) and authorizes `proxy` as the only permitted sender.
contract HedgeExecutorTest is Test {
    event HedgeExecuted(address indexed rvmId, bytes32 indexed poolId, int256 deltaApplied, int256 newPosition);

    HedgeExecutor internal executor;
    address internal proxy = makeAddr("callbackProxy");
    address internal authorizedRvm = address(this); // deployer == rvm_id
    bytes32 internal poolId = keccak256("ETH/USDC");

    function setUp() public {
        executor = new HedgeExecutor(proxy);
    }

    function test_InitialState() public view {
        assertEq(executor.netHedgePosition(), 0, "position starts flat");
        assertEq(executor.hedgeCount(), 0, "no hedges yet");
        assertEq(executor.lastHedgeBlock(), 0, "no hedge block yet");
    }

    function test_ValidCallback_UpdatesPositionAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit HedgeExecuted(authorizedRvm, poolId, 1e18, 1e18);

        vm.prank(proxy);
        executor.onReactiveRebalance(authorizedRvm, poolId, 1e18);

        assertEq(executor.netHedgePosition(), 1e18, "position updated");
        assertEq(executor.hedgeCount(), 1, "count incremented");
        assertEq(executor.lastHedgeBlock(), block.number, "block recorded");
    }

    function test_Callback_Accumulates() public {
        vm.startPrank(proxy);
        executor.onReactiveRebalance(authorizedRvm, poolId, 3e18);
        executor.onReactiveRebalance(authorizedRvm, poolId, -1e18);
        vm.stopPrank();
        assertEq(executor.netHedgePosition(), 2e18, "net accumulates signed deltas");
        assertEq(executor.hedgeCount(), 2);
    }

    function test_RevertWhen_NotProxy() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(bytes("Authorized sender only"));
        executor.onReactiveRebalance(authorizedRvm, poolId, 1e18);
    }

    function test_RevertWhen_WrongRvm() public {
        vm.prank(proxy);
        vm.expectRevert(bytes("Authorized RVM ID only"));
        executor.onReactiveRebalance(makeAddr("notRvm"), poolId, 1e18);
    }
}
