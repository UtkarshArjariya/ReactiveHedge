// Minimal ABIs — only the views + events the dashboard reads.

export const hookAbi = [
  { type: "function", name: "hedgeIntent", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ type: "int256" }] },
  { type: "function", name: "lpExposure0", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }, { name: "", type: "address" }], outputs: [{ type: "int256" }] },
  { type: "function", name: "lpExposure1", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }, { name: "", type: "address" }], outputs: [{ type: "int256" }] },
  {
    type: "event", name: "SwapObserved",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "amount0", type: "int256", indexed: false },
      { name: "amount1", type: "int256", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
    ],
  },
  {
    type: "event", name: "RebalanceExecuted",
    inputs: [
      { name: "rvmId", type: "address", indexed: true },
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "hedgeDelta", type: "int256", indexed: false },
      { name: "newIntent", type: "int256", indexed: false },
    ],
  },
] as const;

export const rscAbi = [
  { type: "function", name: "cumulativeDrift", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "driftThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hedgesFired", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastSqrtPriceX96", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }] },
  {
    type: "event", name: "Callback",
    inputs: [
      { name: "chain_id", type: "uint256", indexed: true },
      { name: "_contract", type: "address", indexed: true },
      { name: "gas_limit", type: "uint64", indexed: true },
      { name: "payload", type: "bytes", indexed: false },
    ],
  },
] as const;

export const executorAbi = [
  { type: "function", name: "netHedgePosition", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "hedgeCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastHedgeBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event", name: "HedgeExecuted",
    inputs: [
      { name: "rvmId", type: "address", indexed: true },
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "deltaApplied", type: "int256", indexed: false },
      { name: "newPosition", type: "int256", indexed: false },
    ],
  },
] as const;

// PoolSwapTest.swap — used by the "fire real test swap" control (FR-23).
export const swapRouterAbi = [
  {
    type: "function", name: "swap", stateMutability: "payable",
    inputs: [
      {
        name: "key", type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params", type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
      {
        name: "testSettings", type: "tuple",
        components: [
          { name: "takeClaims", type: "bool" },
          { name: "settleUsingBurn", type: "bool" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;
