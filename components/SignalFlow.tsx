import { type CSSProperties } from "react";
import { chainMeta } from "../lib/config";

export type SignalStage = "idle" | "observed" | "reacting" | "executed";

type SignalFlowProps = {
  stage: SignalStage;
  latency: string;
  paused: boolean;
  demoMode: boolean;
  replayNonce: number;
};

const stations = [
  {
    id: "observed",
    chain: "origin",
    title: "UNICHAIN SEPOLIA",
    event: "SwapObserved",
    metric: "pool drift +1.9%",
    tx: "tx 0x... ↗",
  },
  {
    id: "reacting",
    chain: "reactive",
    title: "REACTIVE LASNA",
    event: "react() · drift↑",
    metric: "drift > threshold ✓",
    tx: "callback armed",
  },
  {
    id: "executed",
    chain: "dest",
    title: "BASE SEPOLIA",
    event: "HedgeExecuted",
    metric: "netHedge +0.29",
    tx: "tx 0x... ↗",
  },
] as const;

export default function SignalFlow({ stage, latency, paused, demoMode, replayNonce }: SignalFlowProps) {
  return (
    <div
      className={`signal-flow stage-${stage} ${paused ? "is-paused" : ""}`}
      aria-label="Cross-chain signal flow from Unichain Sepolia through Reactive Lasna to Base Sepolia"
    >
      <div className="signal-status">
        <span>{demoMode ? "animated demo loop" : "live event stream"}</span>
        <strong>{stage === "idle" ? "Listening for swaps..." : `${stage} · ${latency}`}</strong>
      </div>

      <div className="signal-rail" aria-hidden="true">
        <span className="rail-line" />
        <span className="rail-shimmer" />
        <span className="signal-packet" key={replayNonce} />
      </div>

      <div className="station-grid">
        {stations.map((station) => {
          const active =
            stage === station.id ||
            (stage === "executed" && station.id !== "observed") ||
            (stage === "reacting" && station.id === "observed");
          const complete =
            stage === "executed" ||
            (stage === "reacting" && station.id === "observed") ||
            (stage === "observed" && station.id === "observed");

          return (
            <article
              className={`station ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
              key={station.id}
              style={{ "--chain": chainMeta[station.chain].color } as CSSProperties}
            >
              <span className="station-dot" />
              <div>
                <h3>{station.title}</h3>
                <strong>{station.event}</strong>
                <span>{station.metric}</span>
                <small>{station.tx}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="latency-readout">
        <span>reactive latency</span>
        <strong>{latency}</strong>
      </div>
    </div>
  );
}
