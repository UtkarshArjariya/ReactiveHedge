// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {HedgeExecutor} from "../src/destination/HedgeExecutor.sol";

/// @notice Phase 0 smoke test for the destination contract.
contract HedgeExecutorTest is Test {
    HedgeExecutor internal executor;
    address internal proxy = makeAddr("callbackProxy");

    function setUp() public {
        executor = new HedgeExecutor(proxy);
    }

    function test_InitialState() public view {
        assertEq(executor.netHedgePosition(), 0, "position starts flat");
        assertEq(executor.hedgeCount(), 0, "no hedges yet");
        assertEq(executor.lastHedgeBlock(), 0, "no hedge block yet");
    }
}
