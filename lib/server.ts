// NOTE: imported only by route handlers (app/api/*), so it always runs server-side.
import { createPublicClient, http, type Address, type Hex } from "viem";
import { unichainSepolia, baseSepolia, reactiveLasna } from "./chains";

// Server-side reads only. RPCs prefer a private server var (RPC_*), then the
// public NEXT_PUBLIC_* fallback — so the operator can point the server at a
// rate-limited / authenticated RPC without exposing it to the browser. This is
// the "backend" half of the unified app: the browser never calls an RPC directly.

const pick = (...keys: string[]) => {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.length > 0) return v;
  }
  return undefined;
};

const asAddr = (...keys: string[]): Address | undefined => {
  const v = pick(...keys);
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined;
};

export const serverConfig = {
  hook: asAddr("HOOK_ADDRESS", "NEXT_PUBLIC_HOOK_ADDRESS"),
  rsc: asAddr("RSC_ADDRESS", "NEXT_PUBLIC_RSC_ADDRESS"),
  executor: asAddr("EXECUTOR_ADDRESS", "NEXT_PUBLIC_EXECUTOR_ADDRESS"),
  poolId: (pick("POOL_ID", "NEXT_PUBLIC_POOL_ID") as Hex) || undefined,
};

const rpc = (chainKey: "UNICHAIN" | "BASE" | "REACTIVE", fallback: string) =>
  pick(`RPC_${chainKey}_SEPOLIA`, `RPC_${chainKey}`, `NEXT_PUBLIC_${chainKey}_SEPOLIA_RPC`, `NEXT_PUBLIC_${chainKey}_LASNA_RPC`) ||
  fallback;

export const srvUnichain = createPublicClient({
  chain: unichainSepolia,
  transport: http(rpc("UNICHAIN", "https://sepolia.unichain.org")),
});
export const srvBase = createPublicClient({
  chain: baseSepolia,
  transport: http(rpc("BASE", "https://sepolia.base.org")),
});
export const srvReactive = createPublicClient({
  chain: reactiveLasna,
  transport: http(rpc("REACTIVE", "https://lasna-rpc.rnk.dev/")),
});

export const isServerConfigured = Boolean(
  serverConfig.hook && serverConfig.rsc && serverConfig.executor && serverConfig.poolId,
);
