// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeltaMath} from "../src/libraries/DeltaMath.sol";

/// @notice Phase 0 placeholder. Real known-answer vectors land in Phase 2.
contract DeltaMathTest is Test {
    function test_Stubs_ReturnZero() public pure {
        (int256 d0, int256 d1) = DeltaMath.netDelta(int24(-887220), int24(887220), uint160(1 << 96), uint128(1e18));
        assertEq(d0, 0);
        assertEq(d1, 0);
        assertEq(DeltaMath.hedgeSize(0, 0), 0);
        assertEq(DeltaMath.impermanentLoss(1e18), 0);
    }
}
