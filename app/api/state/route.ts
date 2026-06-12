import { NextResponse } from "next/server";
import { serverConfig, isServerConfigured, srvUnichain, srvBase, srvReactive } from "@/lib/server";
import { hookAbi, rscAbi, executorAbi } from "@/lib/abis";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Server-side snapshot of contract state across the three chains. */
export async function GET() {
  if (!isServerConfigured) {
    return NextResponse.json({ configured: false });
  }
  try {
    const [drift, threshold, hedgesFired, lastSqrt] = await Promise.all([
      srvReactive.readContract({ address: serverConfig.rsc!, abi: rscAbi, functionName: "cumulativeDrift" }),
      srvReactive.readContract({ address: serverConfig.rsc!, abi: rscAbi, functionName: "driftThreshold" }),
      srvReactive.readContract({ address: serverConfig.rsc!, abi: rscAbi, functionName: "hedgesFired" }),
      srvReactive.readContract({ address: serverConfig.rsc!, abi: rscAbi, functionName: "lastSqrtPriceX96" }),
    ]);
    const [netHedge, hedgeCount, lastHedgeBlock] = await Promise.all([
      srvBase.readContract({ address: serverConfig.executor!, abi: executorAbi, functionName: "netHedgePosition" }),
      srvBase.readContract({ address: serverConfig.executor!, abi: executorAbi, functionName: "hedgeCount" }),
      srvBase.readContract({ address: serverConfig.executor!, abi: executorAbi, functionName: "lastHedgeBlock" }),
    ]);
    const hedgeIntent = await srvUnichain.readContract({
      address: serverConfig.hook!, abi: hookAbi, functionName: "hedgeIntent", args: [serverConfig.poolId as Hex],
    });

    return NextResponse.json({
      configured: true,
      drift: drift.toString(),
      threshold: threshold.toString(),
      hedgesFired: hedgesFired.toString(),
      lastSqrtPriceX96: lastSqrt.toString(),
      netHedge: netHedge.toString(),
      hedgeCount: hedgeCount.toString(),
      lastHedgeBlock: lastHedgeBlock.toString(),
      hedgeIntent: hedgeIntent.toString(),
      addresses: {
        hook: serverConfig.hook,
        rsc: serverConfig.rsc,
        executor: serverConfig.executor,
        poolId: serverConfig.poolId,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: e?.shortMessage || e?.message || "read failed" }, { status: 502 });
  }
}
