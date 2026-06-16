import { NextResponse } from "next/server";
import { serverConfig, isServerConfigured, srvUnichain, srvBase, srvReactive } from "@/lib/server";
import { hookAbi, rscAbi, executorAbi } from "@/lib/abis";
import { getAbiItem, type Abi } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOOKBACK = 5_000n; // blocks to scan per chain
// Base Sepolia's public RPC rejects/hangs on wide eth_getLogs ranges (~5k), so the
// destination query uses a tighter window. ~2s blocks → 1800 blocks ≈ 1h of history.
const LOOKBACK_DEST = 1_800n;

type Feed = { chain: "origin" | "reactive" | "dest"; name: string; detail: string; tx: string; block: string; price?: string; ts: number };

// Approx block time (ms) per chain — used only to estimate each event's wall-clock
// age so the three feeds can be interleaved chronologically. Raw block numbers are
// NOT comparable across chains (different genesis/height), so we sort by ts instead.
const BLOCK_MS: Record<Feed["chain"], number> = { origin: 1_000, reactive: 2_000, dest: 2_000 };

async function recent(
  client: any, address: `0x${string}`, abi: Abi, eventName: string,
  map: (args: any) => { name: string; detail: string; price?: string },
  chain: Feed["chain"],
): Promise<Feed[]> {
  try {
    const lookback = chain === "dest" ? LOOKBACK_DEST : LOOKBACK;
    const head = await client.getBlockNumber();
    const fromBlock = head > lookback ? head - lookback : 0n;
    const logs = await client.getLogs({
      address,
      event: getAbiItem({ abi, name: eventName }) as any,
      fromBlock,
      toBlock: head,
    });
    const now = Date.now();
    return logs.slice(-12).map((l: any) => {
      const m = map(l.args);
      const blk = l.blockNumber ?? head;
      const ts = now - Number(head - blk) * BLOCK_MS[chain];
      return { chain, name: m.name, detail: m.detail, price: m.price, tx: l.transactionHash, block: blk.toString(), ts };
    });
  } catch {
    return [];
  }
}

/** Recent SwapObserved / Callback / HedgeExecuted across the three chains. */
export async function GET() {
  if (!isServerConfigured) return NextResponse.json({ configured: false, events: [] });

  const [swaps, callbacks, hedges] = await Promise.all([
    recent(srvUnichain, serverConfig.hook!, hookAbi as Abi, "SwapObserved",
      (a) => ({ name: "SwapObserved", detail: `price ${String(a.sqrtPriceX96).slice(0, 10)}…`, price: String(a.sqrtPriceX96) }), "origin"),
    recent(srvReactive, serverConfig.rsc!, rscAbi as Abi, "Callback",
      (a) => ({ name: "Callback", detail: `gas ${a.gas_limit} → ${String(a._contract).slice(0, 8)}…` }), "reactive"),
    recent(srvBase, serverConfig.executor!, executorAbi as Abi, "HedgeExecuted",
      (a) => ({ name: "HedgeExecuted", detail: `Δ ${a.deltaApplied} → ${a.newPosition}` }), "dest"),
  ]);

  const events = [...swaps, ...callbacks, ...hedges].sort((a, b) => b.ts - a.ts);
  return NextResponse.json({ configured: true, events });
}
