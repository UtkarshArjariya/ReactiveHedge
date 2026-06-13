import { ImageResponse } from "next/og";

/**
 * Branded Open Graph card for "/". Ink background, the signature Trace
 * (divergence → convergence), the thesis headline, and the 93% backtest
 * readout — so shared links read as intentional, in the instrument-panel
 * palette and the JetBrains Mono "readout" voice.
 */
export const alt =
  "ReactiveHedge — cross-chain impermanent-loss protection for Uniswap v4. 93% less impermanent loss over a 30-day ETH/USDC backtest.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0b141b";
const PANEL = "#0f1d26";
const RULE = "#1b3540";
const ASH = "#7e9a9c";
const PHOSPHOR = "#e9f1ec";
const DRIFT = "#f4a24c";
const HEDGE = "#4fe0c2";

// Fetch a Google font as a binary buffer for Satori. Subset to `text` when given
// to keep the payload small. Returns null on any failure so the card still renders.
async function loadFont(family: string, weight: number, text?: string): Promise<ArrayBuffer | null> {
  try {
    const q = `family=${family.replace(/ /g, "+")}:wght@${weight}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?${q}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
      })
    ).text();
    const src = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!src) return null;
    return await (await fetch(src)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [mono, monoBold] = await Promise.all([loadFont("JetBrains Mono", 400), loadFont("JetBrains Mono", 700)]);
  const fonts = [
    mono && { name: "JetBrains Mono", data: mono, weight: 400 as const, style: "normal" as const },
    monoBold && { name: "JetBrains Mono", data: monoBold, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: INK,
          padding: 56,
          fontFamily: "JetBrains Mono",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            border: `1px solid ${RULE}`,
            borderRadius: 4,
            background: PANEL,
            padding: 48,
            justifyContent: "space-between",
          }}
        >
          {/* Top rail: wordmark + context */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg width="54" height="36" viewBox="0 0 36 24" fill="none">
                <path d="M2 12C7 12 10 20 18 20C26 20 29 12 34 12" stroke={HEDGE} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                <path d="M2 12C7 12 10 4 18 4C26 4 29 12 34 12" stroke={HEDGE} strokeWidth="2" strokeLinecap="round" />
                <circle cx="18" cy="12" r="1.7" fill={HEDGE} />
              </svg>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>
                <span style={{ color: PHOSPHOR }}>Reactive</span>
                <span style={{ color: HEDGE }}>Hedge</span>
              </div>
            </div>
            <div style={{ display: "flex", color: ASH, fontSize: 19, letterSpacing: "0.08em" }}>
              UNISWAP V4 · ETH/USDC
            </div>
          </div>

          {/* The Trace — divergence (amber gap) the stale pool can't see. */}
          <div style={{ display: "flex", width: "100%", height: 210 }}>
            <svg width="100%" height="210" viewBox="0 0 600 200" preserveAspectRatio="none">
              <path
                d="M0,100 C120,100 180,52 300,52 C420,52 480,100 600,100 C480,100 420,148 300,148 C180,148 120,100 0,100 Z"
                fill={DRIFT}
                fillOpacity={0.16}
              />
              <path d="M0,100 C120,100 180,52 300,52 C420,52 480,100 600,100" fill="none" stroke={PHOSPHOR} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <path d="M0,100 C120,100 180,148 300,148 C420,148 480,100 600,100" fill="none" stroke={PHOSPHOR} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={300} cy={100} r={14} fill={HEDGE} fillOpacity={0.22} />
              <circle cx={300} cy={100} r={5} fill={HEDGE} />
            </svg>
          </div>

          {/* Headline + the 93% readout */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
            <div
              style={{
                display: "flex",
                maxWidth: 680,
                color: PHOSPHOR,
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: "-0.01em",
              }}
            >
              Hedge impermanent loss before arbitrage opens the gap.
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: HEDGE, fontSize: 116, fontWeight: 700, lineHeight: 1 }}>93%</div>
              <div style={{ display: "flex", color: ASH, fontSize: 18, marginTop: 8, letterSpacing: "0.04em" }}>
                less IL · 30-day backtest
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
