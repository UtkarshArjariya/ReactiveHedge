// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {DeltaMath} from "../src/libraries/DeltaMath.sol";

/// @notice Replays a 30-day ETH/USDC series and reports impermanent loss WITH vs
///         WITHOUT ReactiveHedge against an unhedged baseline (FR-25), using
///         DeltaMath.impermanentLoss. Prints the headline number and writes
///         backtest/results.csv (rendered to an SVG by backtest/chart.mjs).
///
/// Assumptions (stated explicitly):
///   1. Full-range constant-product position (matches DeltaMath's FR-16 model).
///   2. Unhedged IL is the classic LP-vs-HODL loss at the *net* price ratio
///      (path-independent for a passive LP).
///   3. ReactiveHedge re-neutralizes delta whenever cumulative drift since the
///      last rebalance crosses DRIFT_THRESHOLD_BPS, so IL only accrues *within*
///      each sub-interval; total hedged IL is the sum of those small, convex
///      pieces. The hedge is assumed to perfectly offset delta at each
///      rebalance; rebalance cost / slippage is out of scope for the MVP figure.
///
/// Run: forge script script/Backtest.s.sol
contract Backtest is Script {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant DRIFT_THRESHOLD_BPS = 100; // rebalance on >=1% moves

    function run() external {
        // 31 daily ETH/USDC closes — a trending, volatile month (3000 -> 4500).
        uint256[] memory p = new uint256[](31);
        uint16[31] memory raw = [
            uint16(3000), 3050, 2980, 3120, 3200, 3150, 3300, 3420, 3380, 3500,
            3650, 3600, 3750, 3820, 3900, 3850, 4000, 4100, 4050, 4200,
            4150, 4300, 4400, 4350, 4250, 4380, 4500, 4480, 4550, 4600, 4500
        ];
        for (uint256 i; i < 31; ++i) {
            p[i] = uint256(raw[i]);
        }

        uint256 p0 = p[0];
        uint256 ref = p0; // reference price for the current hedge interval
        uint256 cumHedgedBps; // accumulated locked-in hedged IL (bps)

        string memory csv = "day,price,unhedged_bps,hedged_bps\n";
        csv = string.concat(csv, "0,", vm.toString(p0), ",0,0\n");

        uint256 unhedgedFinalBps;
        uint256 hedgedFinalBps;
        uint256 rebalances;

        for (uint256 i = 1; i < p.length; ++i) {
            // Unhedged: IL vs HODL at the net move from day 0.
            uint256 unhedgedBps = ilBps(p[i], p0);

            // Hedged: lock in the current segment's IL whenever drift crosses
            // the threshold, then reset the reference (a rebalance).
            uint256 driftBps = absDiff(p[i], ref) * 10_000 / ref;
            uint256 openSegBps = ilBps(p[i], ref);
            if (driftBps >= DRIFT_THRESHOLD_BPS) {
                cumHedgedBps += openSegBps;
                ref = p[i];
                openSegBps = 0;
                ++rebalances;
            }
            uint256 hedgedBps = cumHedgedBps + openSegBps;

            csv = string.concat(
                csv, vm.toString(i), ",", vm.toString(p[i]), ",", vm.toString(unhedgedBps), ",", vm.toString(hedgedBps), "\n"
            );

            unhedgedFinalBps = unhedgedBps;
            hedgedFinalBps = hedgedBps;
        }

        vm.writeFile("backtest/results.csv", csv);

        uint256 reductionPct =
            unhedgedFinalBps == 0 ? 0 : (unhedgedFinalBps - hedgedFinalBps) * 100 / unhedgedFinalBps;

        console2.log("=== ReactiveHedge backtest (ETH/USDC, 30 days) ===");
        console2.log("rebalances:", rebalances);
        console2.log("unhedged IL (bps):", unhedgedFinalBps);
        console2.log("hedged IL   (bps):", hedgedFinalBps);
        console2.log("HEADLINE: ReactiveHedge reduces IL by (percent):", reductionPct);
        console2.log("wrote backtest/results.csv -> run `node backtest/chart.mjs` for the SVG");
    }

    /// @dev |impermanentLoss(numer/denom)| expressed in basis points.
    function ilBps(uint256 numer, uint256 denom) internal pure returns (uint256) {
        uint256 ratioWad = numer * WAD / denom;
        int256 il = DeltaMath.impermanentLoss(ratioWad); // <= 0
        uint256 mag = uint256(-il); // WAD magnitude
        return mag * 10_000 / WAD; // -> bps
    }

    function absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }
}
