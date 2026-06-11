// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title DeltaMath
/// @notice Pure IL / delta-hedging math for ReactiveHedge.
/// @dev MVP simplification (stated explicitly per FR-16): a full-range
///      constant-product position, so token holdings are closed-form in the
///      price alone and the tick bounds are ignored. All functions are pure and
///      covered by known-answer vectors in test/DeltaMath.t.sol.
library DeltaMath {
    /// @notice 1e18 fixed-point scale used for ratios and signed deltas.
    int256 internal constant WAD = 1e18;
    uint256 internal constant UWAD = 1e18;

    /// @dev Q64.96 scale used by Uniswap v4 sqrt prices.
    uint256 private constant Q96 = 0x1000000000000000000000000; // 2**96

    /// @notice Token holdings (signed exposure) of a full-range LP position.
    /// @dev For liquidity `L` at price `P` (with sqrtP = sqrtPriceX96 / 2**96):
    ///        amount0 = L / sqrtP = L * 2**96 / sqrtPriceX96
    ///        amount1 = L * sqrtP = L * sqrtPriceX96 / 2**96
    ///      `tickLower`/`tickUpper` are accepted for interface stability but
    ///      unused under the full-range assumption. Values are raw token units;
    ///      both are non-negative (an LP is long both tokens).
    /// @return delta0 token0 exposure
    /// @return delta1 token1 exposure
    function netDelta(int24, /*tickLower*/ int24, /*tickUpper*/ uint160 sqrtPriceX96, uint128 liquidity)
        internal
        pure
        returns (int256 delta0, int256 delta1)
    {
        uint256 l = uint256(liquidity);
        uint256 sp = uint256(sqrtPriceX96);
        // Reasonable testnet ranges keep these within uint256 (see overflow note).
        uint256 amount0 = (l * Q96) / sp;
        uint256 amount1 = (l * sp) / Q96;
        return (int256(amount0), int256(amount1));
    }

    /// @notice Hedge adjustment to offset a delta exposure over a price move.
    /// @dev Short the volatile-asset exposure proportionally to the move:
    ///        hedge = -(netDelta * priceMoveWad) / WAD
    ///      A positive `priceMoveWad` (price up) yields a negative (short) hedge.
    /// @param netDelta_ The token0 (volatile) exposure from {netDelta}.
    /// @param priceMoveWad Signed fractional price move (WAD, e.g. 0.1e18 = +10%).
    function hedgeSize(int256 netDelta_, int256 priceMoveWad) internal pure returns (int256) {
        return -(netDelta_ * priceMoveWad) / WAD;
    }

    /// @notice Impermanent loss of a constant-product position vs HODL.
    /// @dev IL(r) = 2*sqrt(r)/(1+r) - 1, where r is the price ratio P_new/P_old.
    ///      Returns a signed WAD; the value is <= 0 (a loss), 0 at r == 1.
    /// @param priceRatioWad The price ratio in WAD (1e18 == unchanged price).
    /// @return il signed impermanent loss (WAD), e.g. -0.0571e18 ≈ -5.71% at r=2.
    function impermanentLoss(uint256 priceRatioWad) internal pure returns (int256 il) {
        if (priceRatioWad == UWAD) return 0;
        // sqrt(r) in WAD = sqrt(r_wad * 1e18).
        uint256 sqrtRatioWad = sqrt(priceRatioWad * UWAD);
        uint256 numerator = 2 * sqrtRatioWad; // 2*sqrt(r), WAD
        uint256 denominator = UWAD + priceRatioWad; // 1 + r, WAD
        uint256 ratioWad = (numerator * UWAD) / denominator; // V_lp / V_hodl, WAD
        il = int256(ratioWad) - WAD;
    }

    /// @notice Integer square root (Babylonian method).
    function sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
