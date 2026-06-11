import { NextResponse } from "next/server";
import { serverConfig, isServerConfigured, srvUnichain, srvBase, srvReactive } from "@/lib/server";
import { hookAbi, rscAbi, executorAbi } from "@/lib/abis";
import { getAbiItem, type Abi } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOOKBACK = 5_000n; // blocks to scan per chain

type Feed = { chain: "origin" | "reactive" | "dest"; name: string; detail: string; tx: string; block: string };

async function recent(
  client: any, address: `0x${string}`, abi: Abi, eventName: string,
  map: (args: any) => { name: string; detail: string },
  chain: Feed["chain"],
): Promise<Feed[]> {
  try {
    const head = await client.getBlockNumber();
    const fromBlock = head > LOOKBACK ? head - LOOKBACK : 0n;
    const logs = await client.getLogs({
      address,
      event: getAbiItem({ abi, name: eventName }) as any,
      fromBlock,
      toBlock: head,
    });
    return logs.slice(-12).map((l: any) => {
      const m = map(l.args);
      return { chain, name: m.name, detail: m.detail, tx: l.transactionHash, block: l.blockNumber?.toString() ?? "" };
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
      (a) => ({ name: "SwapObserved", detail: `price ${String(a.sqrtPriceX96).slice(0, 10)}…` }), "origin"),
    recent(srvReactive, serverConfig.rsc!, rscAbi as Abi, "Callback",
      (a) => ({ name: "Callback", detail: `gas ${a.gas_limit} → ${String(a._contract).slice(0, 8)}…` }), "reactive"),
    recent(srvBase, serverConfig.executor!, executorAbi as Abi, "HedgeExecuted",
      (a) => ({ name: "HedgeExecuted", detail: `Δ ${a.deltaApplied} → ${a.newPosition}` }), "dest"),
  ]);

  const events = [...swaps, ...callbacks, ...hedges].sort((a, b) => Number(BigInt(b.block || 0) - BigInt(a.block || 0)));
  return NextResponse.json({ configured: true, events });
}
