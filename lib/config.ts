import type { Address, Hex } from "viem";

// Client-exposed config only. Live reads go through the server route handlers
// (/api/state, /api/events); the browser keeps just what the demo wallet action
// and the display need.
const addr = (k: string): Address | undefined => {
  const v = process.env[k];
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined;
};

export const config = {
  hook: addr("NEXT_PUBLIC_HOOK_ADDRESS"),
  rsc: addr("NEXT_PUBLIC_RSC_ADDRESS"),
  executor: addr("NEXT_PUBLIC_EXECUTOR_ADDRESS"),
  swapRouter: addr("NEXT_PUBLIC_SWAP_ROUTER"),
  currency0: addr("NEXT_PUBLIC_POOL_CURRENCY0"),
  currency1: addr("NEXT_PUBLIC_POOL_CURRENCY1"),
  poolId: (process.env.NEXT_PUBLIC_POOL_ID as Hex) || undefined,
  reactscan: process.env.NEXT_PUBLIC_REACTSCAN_URL || "https://lasna.reactscan.net",
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/utkarsharjariya/ReactiveHedge",
};

/** Whether the demo "push external price" swap can be sent (needs router + pool). */
export const canSwap = Boolean(config.swapRouter && config.currency0 && config.currency1 && config.hook);

export const chainMeta = {
  origin: { name: "Unichain Sepolia", id: 1301, color: "var(--uni)", explorer: "https://sepolia.uniscan.xyz" },
  reactive: { name: "Reactive Lasna", id: 5318007, color: "var(--rx)", explorer: config.reactscan },
  dest: { name: "Base Sepolia", id: 84532, color: "var(--base)", explorer: "https://sepolia.basescan.org" },
} as const;
