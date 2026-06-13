import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import { Trace } from "@/components/Trace";

/**
 * Marketing landing page (served at "/").
 *
 * The narrative spine is watch → detect → hedge, carried by one recurring
 * instrument — the Trace — in three deliberate states:
 *   • Hero        — animated loop (drift → pulse → converge): the argument.
 *   • The problem — frozen in amber/drift: the danger, before anything acts.
 *   • How it works — settled mint/converged: the resolution, after the flow.
 *
 * Everything is concrete ETH/USDC. The single proof point is the 30-day
 * backtest: 2.02% → 0.14% IL (a 93% reduction), presented as a readout, not
 * a hero number. No program/cohort/competition references anywhere.
 */

// Leave the canonical repo URL as a single placeholder constant.
const REPO_URL = "https://github.com/your-org/reactivehedge";

const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center rounded bg-hedge px-6 font-mono text-xs " +
  "uppercase tracking-[0.08em] text-ink transition-[transform,filter] duration-150 " +
  "hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-rule px-6 " +
  "font-mono text-xs uppercase tracking-[0.08em] text-phosphor transition-colors duration-150 " +
  "hover:border-hedge hover:text-hedge focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const sectionLabel = "font-mono text-[11px] uppercase tracking-[0.14em] text-ash";

export default function MarketingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* ── 1 · HERO ─────────────────────────────────────────────────────
          The Trace is the hero. The headline states the thesis in plain
          words; the animated drift → pulse → converge is the visual argument. */}
      <section className="py-16 sm:py-24" aria-labelledby="hero-heading">
        <p className={sectionLabel}>
          Cross-chain IL protection · Uniswap v4 · ETH/USDC
        </p>

        <h1
          id="hero-heading"
          className="mt-5 max-w-4xl text-balance font-display text-4xl font-medium leading-[1.03] tracking-[-0.015em] text-phosphor sm:text-6xl"
        >
          A Uniswap v4 hook can only act when the pool is touched.{" "}
          <span className="text-hedge">
            ReactiveHedge acts when the price moves somewhere else.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ash sm:text-lg">
          The instant ETH moves on a faster venue, the gap between that price and the one your
          pool still quotes is impermanent loss — and we close it before arbitrage opens it.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/app" className={ctaPrimary}>
            Launch app
          </Link>
          <Link
            href="#how-it-works"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash underline-offset-4 transition-colors hover:text-hedge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            See how it works ↓
          </Link>
        </div>

        {/* The signature instrument, animating the whole sequence. */}
        <Card className="relative mt-14 overflow-hidden p-5 sm:mt-16 sm:p-8">
          <div className="relative flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
            <span>Divergence → convergence</span>
            <span>ETH/USDC</span>
          </div>
          <Trace
            className="relative mt-6"
            animate
            label
            height="clamp(180px, 30vw, 300px)"
          />
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ash">
            <span>Pool price (stale)</span>
            <span>Reference price (off-pool)</span>
          </div>
        </Card>
      </section>

      {/* ── 2 · THE PROBLEM ──────────────────────────────────────────────
          Impermanent loss as off-pool drift the stale pool can't see. This
          section is the danger — amber/drift throughout, with the Trace
          frozen in its drifting state. */}
      <section
        id="problem"
        className="scroll-mt-24 border-t border-rule py-16 sm:py-24"
        aria-labelledby="problem-heading"
      >
        <p className={sectionLabel}>The problem</p>

        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h2
              id="problem-heading"
              className="max-w-xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-phosphor sm:text-4xl"
            >
              Your pool quotes a price the rest of the market has already left behind.
            </h2>

            <div className="mt-6 max-w-xl space-y-4 text-base leading-relaxed text-ash">
              <p>
                A constant-product pool only re-prices when someone trades against it. So when ETH
                moves on a faster venue, your ETH/USDC pool keeps quoting the{" "}
                <span className="text-drift">old price</span> — a growing gap it has no way to see.
              </p>
              <p>
                That gap is impermanent loss. It is not an abstraction or a fee: it is the
                difference between holding your tokens and leaving them in a pool that is
                mispricing them in real time.
              </p>
              <p className="text-phosphor">
                Arbitrageurs see the gap immediately. They trade against the stale price and pocket
                the difference — and that difference comes straight out of the liquidity provider.
              </p>
            </div>
          </div>

          {/* Frozen-amber Trace: the drift, before anything acts on it. */}
          <Card inset className="p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                Unprotected position
              </span>
              <Chip tone="drift" dot>
                IL accruing
              </Chip>
            </div>
            <Trace
              className="mt-6"
              animate={false}
              state="drifting"
              label
              height="clamp(160px, 26vw, 240px)"
            />
            <p className="mt-5 font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ash">
              The wider the amber gap runs, the more value drains to arbitrage on the next swap.
            </p>
          </Card>
        </div>
      </section>

      {/* ── 3 · HOW IT WORKS ─────────────────────────────────────────────
          The real ordered sequence: watch → detect → hedge, left to right
          across three chains. Numbered because it is genuinely ordered.
          Ends with the Trace settled into its converged (mint) state. */}
      <section
        id="how-it-works"
        className="scroll-mt-24 border-t border-rule py-16 sm:py-24"
        aria-labelledby="how-heading"
      >
        <p className={sectionLabel}>How it works</p>
        <h2
          id="how-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-phosphor sm:text-4xl"
        >
          Watch the pool, detect the drift off-pool, hedge before the gap is arbitraged.
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          <Step
            n="01"
            title="Watch"
            chain="Unichain Sepolia"
            chainId="1301"
            tone="default"
          >
            The hook observes every swap and liquidity change on the ETH/USDC pool, tracking the LP
            delta and emitting a <code className="text-phosphor">SwapObserved</code> event on each
            touch.
          </Step>

          <FlowArrow />

          <Step
            n="02"
            title="Detect"
            chain="Reactive Network"
            chainId="off-pool"
            tone="drift"
          >
            A Reactive Smart Contract subscribes to those events and to a faster price feed,
            accumulating drift the pool cannot see. When drift crosses the threshold, it fires a
            cross-chain callback.
          </Step>

          <FlowArrow />

          <Step
            n="03"
            title="Hedge"
            chain="Base Sepolia"
            chainId="84532"
            tone="hedge"
          >
            The callback lands on the executor, which opens or adjusts the hedge — closing the LP’s
            exposure before arbitrage can close the gap against them.
          </Step>
        </ol>

        {/* The resolution: paths together, gap turned mint. */}
        <Card className="mt-10 p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
              Protected position
            </span>
            <Chip tone="hedge" dot>
              Hedge fired
            </Chip>
          </div>
          <Trace
            className="mt-6"
            animate={false}
            state="converged"
            label
            height="clamp(140px, 22vw, 200px)"
          />
        </Card>
      </section>

      {/* ── 4 · PROOF ────────────────────────────────────────────────────
          The 93% reduction as an instrument readout — mono numbers, a small
          before/after — not a giant gradient figure. */}
      <section
        id="proof"
        className="scroll-mt-24 border-t border-rule py-16 sm:py-24"
        aria-labelledby="proof-heading"
      >
        <p className={sectionLabel}>Proof</p>
        <h2
          id="proof-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-phosphor sm:text-4xl"
        >
          93% less impermanent loss over a 30-day ETH/USDC backtest.
        </h2>

        <Card className="mt-10 grid gap-10 p-6 sm:p-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          {/* Before / after readout with proportional bars. */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
              Cumulative IL · 30-day ETH/USDC
            </span>

            <dl className="mt-6 space-y-6">
              <ReadoutBar
                label="Unhedged"
                value="2.02%"
                tone="drift"
                widthPct={100}
              />
              <ReadoutBar
                label="ReactiveHedge"
                value="0.14%"
                tone="hedge"
                widthPct={7}
              />
            </dl>
          </div>

          {/* The derived reduction, stated plainly in the readout face. */}
          <div className="flex flex-col justify-center gap-4 border-rule lg:border-l lg:pl-14">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
              Reduction
            </span>
            <p className="font-mono text-5xl font-medium leading-none tabular-nums text-hedge">
              93%
            </p>
            <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ash">
              <span className="text-drift">2.02%</span> →{" "}
              <span className="text-hedge">0.14%</span> cumulative impermanent loss. Backtest
              replays historical ETH/USDC price moves against the hedge logic; not a guarantee of
              live results.
            </p>
          </div>
        </Card>
      </section>

      {/* ── 5 · OPEN SOURCE ──────────────────────────────────────────────
          Fork-this energy: how the three contracts fit, and where the code is. */}
      <section
        id="open-source"
        className="scroll-mt-24 border-t border-rule py-16 sm:py-24"
        aria-labelledby="oss-heading"
      >
        <p className={sectionLabel}>Open source</p>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="oss-heading"
            className="max-w-2xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-phosphor sm:text-4xl"
          >
            Three contracts, three chains, one event-driven loop. Fork it and read every line.
          </h2>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={ctaSecondary}>
            View the repository
          </a>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          <ContractCard
            name="ReactiveHedgeHook"
            chain="Unichain Sepolia"
            chainId="1301"
            role="The v4 hook. Tracks LP delta, emits SwapObserved on every pool touch, and receives the rebalance callback."
          />
          <ContractCard
            name="HedgeReactiveContract"
            chain="Reactive Network"
            chainId="off-pool"
            role="The Reactive Smart Contract. Subscribes to hook events, accumulates drift, and fires the cross-chain callback past threshold."
            tone="drift"
          />
          <ContractCard
            name="HedgeExecutor"
            chain="Base Sepolia"
            chainId="84532"
            role="The destination. Validates the callback sender and executes the hedge — the moment the loop closes."
            tone="hedge"
          />
        </ul>

        <p className="mt-8 max-w-2xl text-base leading-relaxed text-ash">
          Built on Foundry with Uniswap v4-core, v4-periphery, and the Reactive library. The
          frontend reads chain state directly — no backend, no database. Clone it, point it at your
          own pool, and watch the hedge fire.
        </p>
      </section>

      {/* ── 6 · FOOTER + FINAL CTA ───────────────────────────────────────── */}
      <section className="border-t border-rule py-16 sm:py-24" aria-labelledby="cta-heading">
        <div className="flex flex-col items-start gap-6">
          <h2
            id="cta-heading"
            className="max-w-2xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-phosphor sm:text-4xl"
          >
            Watch a cross-chain hedge fire in real time.
          </h2>
          <Link href="/app" className={ctaPrimary}>
            Launch app
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-rule py-8 font-mono text-[11px] uppercase tracking-[0.1em] text-ash sm:flex-row sm:items-center sm:justify-between">
        <span>ReactiveHedge · cross-chain IL protection for Uniswap v4</span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-hedge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            GitHub
          </a>
          <Link
            href="/app"
            className="transition-colors hover:text-hedge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Launch app
          </Link>
        </div>
      </footer>
    </main>
  );
}

/* ── Section helpers ─────────────────────────────────────────────────── */

type Tone = "default" | "drift" | "hedge";

// Solid token borders — opacity modifiers (border-drift/50) don't work on these
// var()-based color tokens, so the marker rings use full-strength accents.
const markerTone: Record<Tone, string> = {
  default: "border-rule text-ash",
  drift: "border-drift text-drift",
  hedge: "border-hedge text-hedge",
};

const chipTone: Record<Tone, "default" | "drift" | "hedge"> = {
  default: "default",
  drift: "drift",
  hedge: "hedge",
};

/** One step in the watch → detect → hedge flow. Rendered as an <li>. */
function Step({
  n,
  title,
  chain,
  chainId,
  tone = "default",
  children,
}: {
  n: string;
  title: string;
  chain: string;
  chainId: string;
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <li className="list-none">
      <Card className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums ${markerTone[tone]}`}
          >
            {n}
          </span>
          <Chip tone={chipTone[tone]}>
            {chain} · {chainId}
          </Chip>
        </div>
        <h3 className="mt-5 font-display text-xl font-medium text-phosphor">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-ash">{children}</p>
      </Card>
    </li>
  );
}

/** Decorative left-to-right connector between flow steps (desktop only). */
function FlowArrow() {
  return (
    <li
      className="hidden list-none items-center justify-center font-mono text-lg text-ash md:flex"
      aria-hidden
    >
      →
    </li>
  );
}

/** A labelled bar in the proof readout — mono value, proportional fill. */
function ReadoutBar({
  label,
  value,
  tone,
  widthPct,
}: {
  label: string;
  value: string;
  tone: "drift" | "hedge";
  widthPct: number;
}) {
  const fill = tone === "drift" ? "bg-drift" : "bg-hedge";
  const text = tone === "drift" ? "text-drift" : "text-hedge";
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
        <dt className="text-ash">{label}</dt>
        <dd className={`text-xl tabular-nums ${text}`}>{value}</dd>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

/** One contract in the open-source breakdown. Rendered as an <li>. */
function ContractCard({
  name,
  chain,
  chainId,
  role,
  tone = "default",
}: {
  name: string;
  chain: string;
  chainId: string;
  role: string;
  tone?: Tone;
}) {
  return (
    <li className="list-none">
      <Card className="flex h-full flex-col p-5 sm:p-6">
        <Chip tone={chipTone[tone]} className="self-start">
          {chain} · {chainId}
        </Chip>
        <p className="mt-4 font-mono text-sm text-phosphor">{name}</p>
        <p className="mt-3 text-sm leading-relaxed text-ash">{role}</p>
      </Card>
    </li>
  );
}
