import { createPublicClient, http, type Address, type Hex } from "viem";
import { unichainSepolia, baseSepolia, reactiveLasna } from "./chains";

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
};

/** True when enough is configured to read live state. */
export const isConfigured = Boolean(config.hook && config.rsc && config.executor && config.poolId);

export const unichainClient = createPublicClient({ chain: unichainSepolia, transport: http() });
export const baseClient = createPublicClient({ chain: baseSepolia, transport: http() });
export const reactiveClient = createPublicClient({ chain: reactiveLasna, transport: http() });

export const chainMeta = {
  origin: { name: "Unichain Sepolia", id: 1301, color: "var(--origin)" },
  reactive: { name: "Reactive Lasna", id: 5318007, color: "var(--reactive)" },
  dest: { name: "Base Sepolia", id: 84532, color: "var(--dest)" },
};
