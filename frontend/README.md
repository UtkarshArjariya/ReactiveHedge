# ReactiveHedge — dashboard

Single-page Next.js + viem dashboard for the live demo. No backend; it reads
chain state directly and streams events.

## Run

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill deployed addresses for live mode
npm run dev                         # http://localhost:3000
```

Leave addresses blank to run in **demo mode** (the "Push external price" button
animates the origin → reactive → destination pipeline so the story reads offline).

## What it shows (FR-22–24)

- **Origin panel** — hook address, pool id, current hedge intent.
- **Signal panel** — RSC cumulative drift vs threshold (progress bar), hedges fired.
- **Destination panel** — net hedge position + hedge count on Base.
- **Live feed** — `SwapObserved` (Unichain), `Callback` (Reactive), `HedgeExecuted` (Base).
- **Push external price** (FR-23) — sends a real swap via a connected wallet, or
  simulates the loop in demo mode.
- **Reactscan link** (FR-24) — and per-event tx links.

Per-chain colors match `ARCHITECTURE.html`: origin `#FF5CAA`, reactive `#38E1FF`,
dest `#FFB454`; Space Grotesk + IBM Plex Mono.
