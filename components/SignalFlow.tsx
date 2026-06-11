// Animated cross-chain signal band: origin → reactive → destination, with a
// pulse that travels the path on a loop. CSS/SMIL only — no client JS needed.
export default function SignalFlow() {
  const stops = [
    { x: 90, label: "event log", color: "var(--origin)" },
    { x: 540, label: "react()", color: "var(--reactive)" },
    { x: 990, label: "callback", color: "var(--dest)" },
  ];
  return (
    <svg viewBox="0 0 1080 96" width="100%" height="96" role="img" aria-label="cross-chain signal flow" style={{ display: "block" }}>
      <defs>
        <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--origin)" stopOpacity="0.55" />
          <stop offset="50%" stopColor="var(--reactive)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--dest)" stopOpacity="0.55" />
        </linearGradient>
        <path id="flowpath" d="M90,40 H990" />
      </defs>

      <line x1="90" y1="40" x2="990" y2="40" stroke="url(#rail)" strokeWidth="1.5" />
      <line x1="90" y1="40" x2="990" y2="40" stroke="url(#rail)" strokeWidth="1.5"
        strokeDasharray="2 10" strokeLinecap="round" opacity="0.6">
        <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.4s" repeatCount="indefinite" />
      </line>

      {stops.map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy={40} r="6" fill="var(--bg)" stroke={s.color} strokeWidth="1.5" />
          <circle cx={s.x} cy={40} r="2.5" fill={s.color} />
          <text x={s.x} y={70} fill="var(--faint)" fontSize="10.5" textAnchor="middle"
            fontFamily="var(--mono)" letterSpacing="1.2" style={{ textTransform: "uppercase" }}>
            {s.label}
          </text>
        </g>
      ))}

      {/* traveling pulse */}
      <circle r="5" fill="var(--reactive)">
        <animateMotion dur="4.4s" repeatCount="indefinite" keyPoints="0;0.5;1" keyTimes="0;0.5;1" calcMode="linear">
          <mpath href="#flowpath" />
        </animateMotion>
        <animate attributeName="fill" values="var(--origin);var(--reactive);var(--dest)" dur="4.4s" repeatCount="indefinite" />
        <animate attributeName="r" values="4;6;4" dur="4.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
