import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the Foundry backtest output (contracts/backtest/results.csv) as JSON. */
export async function GET() {
  try {
    const csv = readFileSync(join(process.cwd(), "contracts", "backtest", "results.csv"), "utf8");
    const rows = csv
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => l.split(",").map(Number))
      .map(([day, price, unhedged_bps, hedged_bps]) => ({ day, price, unhedged_bps, hedged_bps }));

    const last = rows[rows.length - 1];
    const reduction = last && last.unhedged_bps
      ? Math.round(((last.unhedged_bps - last.hedged_bps) / last.unhedged_bps) * 100)
      : 0;

    return NextResponse.json({
      rows,
      unhedgedBps: last?.unhedged_bps ?? 0,
      hedgedBps: last?.hedged_bps ?? 0,
      reduction,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "contracts/backtest/results.csv could not be read" },
      { status: 500 },
    );
  }
}
