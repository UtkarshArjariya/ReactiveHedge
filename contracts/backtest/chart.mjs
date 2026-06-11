#!/usr/bin/env node
// Renders backtest/results.csv (written by script/Backtest.s.sol) into a clean
// SVG line chart: unhedged vs ReactiveHedge cumulative impermanent loss.
// Usage:  node backtest/chart.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rows = readFileSync(join(here, "results.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => l.split(",").map(Number))
  .map(([day, price, unhedged, hedged]) => ({ day, price, unhedged, hedged }));

const W = 880, H = 460, PAD = 56;
const maxBps = Math.max(...rows.map((r) => Math.max(r.unhedged, r.hedged)), 1);
const days = rows.length - 1;
const x = (d) => PAD + (d / days) * (W - 2 * PAD);
const y = (b) => H - PAD - (b / maxBps) * (H - 2 * PAD);
const path = (key) => rows.map((r, i) => `${i ? "L" : "M"}${x(r.day).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");

const unhedgedFinal = rows[rows.length - 1].unhedged;
const hedgedFinal = rows[rows.length - 1].hedged;
const reduction = unhedgedFinal ? Math.round(((unhedgedFinal - hedgedFinal) / unhedgedFinal) * 100) : 0;

const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
  const bps = f * maxBps;
  return `<line x1="${PAD}" y1="${y(bps)}" x2="${W - PAD}" y2="${y(bps)}" stroke="#28324d" stroke-width="1"/>
  <text x="${PAD - 10}" y="${y(bps) + 4}" fill="#56688a" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">${(bps / 100).toFixed(2)}%</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Space Grotesk, system-ui, sans-serif">
  <rect width="${W}" height="${H}" fill="#0b1220" rx="16"/>
  <text x="${PAD}" y="34" fill="#e6edf7" font-size="18" font-weight="700">Impermanent loss — unhedged vs ReactiveHedge</text>
  <text x="${PAD}" y="54" fill="#8093ad" font-size="12" font-family="IBM Plex Mono, monospace">ETH/USDC · 30 days · rebalance threshold 100 bps</text>
  ${yTicks}
  <path d="${path("unhedged")}" fill="none" stroke="#ff5caa" stroke-width="2.5"/>
  <path d="${path("hedged")}" fill="none" stroke="#38e1ff" stroke-width="2.5"/>
  <text x="${W - PAD}" y="${y(unhedgedFinal) - 8}" fill="#ff5caa" font-size="12" text-anchor="end" font-family="IBM Plex Mono, monospace">unhedged ${(unhedgedFinal / 100).toFixed(2)}%</text>
  <text x="${W - PAD}" y="${y(hedgedFinal) - 8}" fill="#38e1ff" font-size="12" text-anchor="end" font-family="IBM Plex Mono, monospace">hedged ${(hedgedFinal / 100).toFixed(2)}%</text>
  <text x="${PAD}" y="${H - 16}" fill="#56688a" font-size="11" font-family="IBM Plex Mono, monospace">day 0</text>
  <text x="${W - PAD}" y="${H - 16}" fill="#56688a" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">day ${days}</text>
  <text x="${W / 2}" y="${H - 16}" fill="#ffb454" font-size="13" text-anchor="middle" font-weight="600">ReactiveHedge reduces IL by ${reduction}% over the period</text>
</svg>`;

writeFileSync(join(here, "il_chart.svg"), svg);
console.log(`Wrote backtest/il_chart.svg`);
console.log(`Headline: ReactiveHedge reduces IL by ${reduction}% (unhedged ${(unhedgedFinal / 100).toFixed(2)}% -> hedged ${(hedgedFinal / 100).toFixed(2)}%)`);
