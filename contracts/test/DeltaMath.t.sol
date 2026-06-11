// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeltaMath} from "../src/libraries/DeltaMath.sol";

/// @notice Known-answer vectors for the IL / delta-hedging math (FR-16/17/18, NFR-5).
contract DeltaMathTest is Test {
    uint160 internal constant SQRT_1 = 0x1000000000000000000000000; // 2**96  => price 1
    uint160 internal constant SQRT_4 = 0x2000000000000000000000000; // 2*2**96 => price 4
    int256 internal constant WAD = 1e18;

    // ── netDelta (full-range) ──────────────────────────────────────────────────

    function test_NetDelta_AtPriceOne() public pure {
        (int256 d0, int256 d1) = DeltaMath.netDelta(-887220, 887220, SQRT_1, 1e18);
        assertEq(d0, 1e18, "amount0 @ P=1");
        assertEq(d1, 1e18, "amount1 @ P=1");
    }

    function test_NetDelta_AtPriceFour() public pure {
        // sqrtP = 2 => amount0 = L/2, amount1 = 2L.
        (int256 d0, int256 d1) = DeltaMath.netDelta(-887220, 887220, SQRT_4, 1e18);
        assertEq(d0, 0.5e18, "amount0 @ P=4");
        assertEq(d1, 2e18, "amount1 @ P=4");
    }

    // ── hedgeSize ────────────────────────────────────────────────────────────--

    function test_HedgeSize_ShortsOnPriceUp() public pure {
        // +10% move on 1.0 delta => short 0.1.
        assertEq(DeltaMath.hedgeSize(1e18, 0.1e18), -0.1e18);
    }

    function test_HedgeSize_LongsOnPriceDown() public pure {
        assertEq(DeltaMath.hedgeSize(1e18, -0.2e18), 0.2e18);
    }

    // ── impermanentLoss ────────────────────────────────────────────────────────

    function test_IL_ZeroAtParity() public pure {
        assertEq(DeltaMath.impermanentLoss(1e18), 0);
    }

    function test_IL_2x_isAbout_5_72pct() public pure {
        // Closed form: 2*sqrt(2)/3 - 1 = -0.0571796...
        int256 il = DeltaMath.impermanentLoss(2e18);
        assertApproxEqAbs(il, -0.057190958e18, 1e12, "IL @ 2x");
    }

    function test_IL_4x_is_20pct() public pure {
        // 2*sqrt(4)/5 - 1 = 4/5 - 1 = -0.2 exactly.
        int256 il = DeltaMath.impermanentLoss(4e18);
        assertApproxEqAbs(il, -0.2e18, 1e9, "IL @ 4x");
    }

    function test_IL_Symmetric_HalfPrice() public pure {
        // IL(0.5) == IL(2) by symmetry.
        int256 ilHalf = DeltaMath.impermanentLoss(0.5e18);
        int256 ilTwo = DeltaMath.impermanentLoss(2e18);
        assertApproxEqAbs(ilHalf, ilTwo, 1e9, "IL symmetry");
    }

    function testFuzz_IL_NeverPositive(uint256 ratio) public pure {
        ratio = bound(ratio, 1e9, 1e30);
        assertLe(DeltaMath.impermanentLoss(ratio), 0);
    }
}
