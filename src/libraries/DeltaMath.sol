// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title DeltaMath
/// @notice Pure IL / delta-hedging math for ReactiveHedge.
/// @dev MVP assumes a full-range constant-product position so the delta is
///      closed-form (see FR-16). Every function is pure and unit-tested with
///      known-answer vectors. Real implementations land in Phase 2.
library DeltaMath {
    /// @notice 1e18 fixed-point scale used for ratios and signed deltas.
    int256 internal constant WAD = 1e18;

    /// @notice Signed delta exposure of an LP position.
    /// @dev TODO(Phase 2): derive from tick range, current price, and liquidity.
    /// @return delta0 signed token0 exposure (WAD)
    /// @return delta1 signed token1 exposure (WAD)
    function netDelta(int24, /*tickLower*/ int24, /*tickUpper*/ uint160, /*sqrtPriceX96*/ uint128 /*liquidity*/ )
        internal
        pure
        returns (int256 delta0, int256 delta1)
    {
        // TODO(Phase 2): full-range closed-form delta.
        return (0, 0);
    }

    /// @notice Hedge adjustment required for a given net delta and price move.
    /// @dev TODO(Phase 2).
    function hedgeSize(int256, /*netDelta*/ int256 /*priceMoveWad*/ ) internal pure returns (int256) {
        // TODO(Phase 2): hedge sizing.
        return 0;
    }

    /// @notice Impermanent loss of a constant-product position vs HODL.
    /// @dev TODO(Phase 2): IL = 2*sqrt(r)/(1+r) - 1, where r is the price ratio.
    function impermanentLoss(uint256 /*priceRatioWad*/ ) internal pure returns (int256) {
        // TODO(Phase 2): IL formula.
        return 0;
    }
}
