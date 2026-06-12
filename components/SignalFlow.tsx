import { type CSSProperties } from "react";
import { chainMeta } from "../lib/config";

export type RaceStage = "listening" | "observed" | "breached" | "hedged" | "stalled";

export type RaceEvent = {
  chain: keyof typeof chainMeta;
  name: string;
  detail: string;
  tx?: string;
  block?: string;
};

type SignalFlowProps = {
  stage: RaceStage;
  configured: boolean;
  drift: number | null;
  threshold: number | null;
  hedgeIntent: number | null;
  netHedge: number | null;
  latest: {
    swap?: RaceEvent;
    callback?: RaceEvent;
    hedge?: RaceEvent;
  };
  onFireTestSwap: () => void;
  canFireTestSwap: boolean;
  fireBusy: boolean;
  actionMessage?: string;
};

const stations = [
  {
    key: "swap",
    chain: "origin",
    label: "Unichain Sepolia",
    event: "SwapObserved",
  },
  {
    key: "callback",
    chain: "reactive",
    label: "Reactive Lasna",
    event: "react()",
  },
  {
    key: "hedge",
    chain: "dest",
    label: "Base Sepolia",
    event: "HedgeExecuted",
  },
] as const;

const txHref = (event?: RaceEvent) => {
  if (!event?.tx) return undefined;
  return `${chainMeta[event.chain].explorer.replace(/\/$/, "")}/tx/${event.tx}`;
};

const short = (value?: string) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "no recent tx");

const fixed = (value: number | null, dp = 0) => (value === null ? "—" : value.toFixed(dp));

export default function SignalFlow({
  stage,
  configured,
  drift,
  threshold,
  hedgeIntent,
  netHedge,
  latest,
  onFireTestSwap,
  canFireTestSwap,
  fireBusy,
  actionMessage,
}: SignalFlowProps) {
  const progress = threshold && drift !== null ? Math.max(0, Math.min(1, drift / threshold)) : 0;
  const driftPercent = drift === null ? null : drift / 100;
  const breachRemaining = threshold !== null && drift !== null ? Math.max(0, threshold - drift) / 100 : null;
  const traceGap = 10 + progress * 44;
  const packetKey = latest.callback?.tx || latest.hedge?.tx || latest.swap?.tx || stage;
  const statusText = !configured
    ? "Live contract config required"
    : stage === "stalled"
      ? "One live feed is stalled"
      : stage === "hedged"
        ? "Hedge landed"
        : stage === "breached"
          ? "Callback in flight"
          : stage === "observed"
            ? "Drift observed"
            : "Listening on Unichain Sepolia";

  return (
    <section className={`race-monitor stage-${stage}`} aria-label="Live ReactiveHedge race monitor">
      <div className="gap-panel">
        <div className="panel-head">
          <span>THE GAP</span>
          <strong>{statusText}</strong>
        </div>
        <div className="gap-grid">
          <svg className="gap-scope" viewBox="0 0 560 210" role="img" aria-label="Pool price versus reference price gap">
            <defs>
              <linearGradient id="gapLeak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--leak)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--leak)" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <path
              className="gap-fill"
              d={`M34 108 C120 92 178 128 250 108 S388 86 526 105 L526 ${105 + traceGap} C388 ${
                86 + traceGap
              } 322 ${128 + traceGap} 250 ${108 + traceGap} S120 ${92 + traceGap} 34 ${108 + traceGap} Z`}
            />
            <path className="pool-trace" d="M34 108 C120 92 178 128 250 108 S388 86 526 105" />
            <path
              className="true-trace"
              d={`M34 ${108 + traceGap} C120 ${92 + traceGap} 178 ${128 + traceGap} 250 ${108 + traceGap} S388 ${
                86 + traceGap
              } 526 ${105 + traceGap}`}
            />
            <text className="trace-label" x="34" y="42">
              pool price
            </text>
            <text className="trace-label" x="34" y="190">
              reference price
            </text>
          </svg>
          <div className="gap-readout">
            <span>live drift</span>
            <strong className="leak-text">{driftPercent === null ? "—" : `+${driftPercent.toFixed(2)}%`}</strong>
            <small>IL leak notional unavailable from current API</small>
          </div>
          <div className="threshold-readout">
            <div className="panel-head compact">
              <span>DRIFT → THRESHOLD</span>
              <strong>{fixed(progress * 100)}%</strong>
            </div>
            <div className="threshold-track" aria-label={`${fixed(progress * 100)} percent of threshold`}>
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="threshold-meta">
              <span>{drift === null ? "—" : `${drift} bps`} drift</span>
              <span>{threshold === null ? "threshold —" : `threshold ${threshold} bps`}</span>
            </div>
            <p>{breachRemaining === null ? "Waiting for live threshold." : `Breach in ${breachRemaining.toFixed(2)}%.`}</p>
          </div>
        </div>
      </div>

      <div className="rail-panel">
        <div className="rail-line" aria-hidden="true">
          <span className="rail-packet" key={packetKey} />
        </div>
        <div className="rail-stations">
          {stations.map((station) => {
            const event = latest[station.key];
            const href = txHref(event);

            return (
              <article
                className={`rail-station ${event ? "has-event" : ""}`}
                key={station.key}
                style={{ "--role": chainMeta[station.chain].color } as CSSProperties}
              >
                <span className="station-node" />
                <h3>{station.label}</h3>
                <strong>{station.event}</strong>
                <p>{event?.detail || (configured ? "no recent event" : "not configured")}</p>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {short(event?.tx)} ↗
                  </a>
                ) : (
                  <span>{short(event?.tx)}</span>
                )}
              </article>
            );
          })}
        </div>
        <div className="race-footer">
          <span>
            latency readout <strong>~7s path</strong>
          </span>
          <span>
            hedge intent <strong>{hedgeIntent === null ? "—" : `${hedgeIntent.toFixed(4)} ETH`}</strong>
          </span>
          <span>
            net hedge <strong>{netHedge === null ? "—" : `${netHedge.toFixed(4)} ETH`}</strong>
          </span>
          <button type="button" className="action-button" onClick={onFireTestSwap} disabled={!canFireTestSwap || fireBusy}>
            {fireBusy ? "Submitting real swap..." : "Fire real test swap"}
          </button>
        </div>
        {actionMessage && <p className="action-message">{actionMessage}</p>}
      </div>
    </section>
  );
}
