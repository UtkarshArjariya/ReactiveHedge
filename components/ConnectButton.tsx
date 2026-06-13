"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { unichainSepolia } from "@/lib/chains";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";

const TARGET = unichainSepolia;
const INSTALL_URL = "https://metamask.io/download/";

/** "0x1234…abcd" — mono, 6 leading / 4 trailing. */
function truncate(addr: string, lead = 6, tail = 4): string {
  return addr.length <= lead + tail + 1 ? addr : `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

/** User cancelling a wallet prompt is a state change, not an error — never surfaced. */
function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; message?: string };
  return e.name === "UserRejectedRequestError" || e.code === 4001 || /reject/i.test(e.message ?? "");
}

// Shared classes so the <a> install link matches the secondary <Button> exactly.
const BUTTON_BASE =
  "inline-flex min-h-9 select-none items-center justify-center gap-2 rounded px-3 font-mono text-[11px] " +
  "uppercase tracking-[0.08em] transition-[color,background-color,border-color,transform] duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hedge focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-ink active:scale-[0.98]";

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
      aria-hidden
    />
  );
}

/** A pulsing status dot — mint when on the right chain, amber when monitoring the wrong one. */
function StatusDot({ tone }: { tone: "hedge" | "drift" }) {
  const bg = tone === "hedge" ? "bg-hedge" : "bg-drift";
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" aria-hidden>
      <span className={cn("absolute inset-0 rounded-full motion-safe:animate-ping", bg)} />
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", bg)} />
    </span>
  );
}

const ICON = "h-3.5 w-3.5 shrink-0";

/**
 * Wallet connect control for the StatusRail (instrument surface). Single component,
 * every state the LP can be in:
 *   - no injected wallet  → "Install MetaMask" link (never a dead button)
 *   - disconnected        → "Connect wallet"
 *   - connecting          → spinner + "Connecting…"
 *   - connected           → mint dot + truncated mono address, menu (copy / explorer / disconnect)
 *   - wrong network       → amber "Switch to Unichain Sepolia" (useSwitchChain) + the account menu
 *   - error               → concise "Couldn't connect / Try again" (user-cancels are NOT errors)
 *
 * Token discipline: mint = good, amber (drift) = action-needed, loss = true failure only.
 * Reconnect-on-refresh is handled by WagmiProvider; this only renders the resolved state.
 */
export function ConnectButton() {
  // Gate on mount so first client render matches SSR (disconnected) — no hydration flash,
  // and window.ethereum (install detection) is only read in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const hasWallet = mounted && typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);
  const wrongNetwork = isConnected && chainId !== TARGET.id;
  const showConnectError = !isConnecting && connectError != null && !isUserRejection(connectError);

  const onConnect = useCallback(() => {
    // EIP-6963 discovery surfaces MetaMask as its own connector; fall back to the
    // explicit injected() connector, then anything available.
    const connector =
      connectors.find((c) => c.id === "io.metamask") ??
      connectors.find((c) => c.name.toLowerCase().includes("metamask")) ??
      connectors.find((c) => c.type === "injected") ??
      connectors[0];
    if (!connector) {
      window.open(INSTALL_URL, "_blank", "noreferrer");
      return;
    }
    connect({ connector });
  }, [connectors, connect]);

  // Pre-mount: a stable, inert "Connect wallet" matching the SSR/disconnected markup.
  if (!mounted) {
    return (
      <Button variant="secondary" size="sm" disabled aria-hidden>
        Connect wallet
      </Button>
    );
  }

  // No injected wallet present → point them at the install page, not a dead button.
  if (!isConnected && !hasWallet) {
    return (
      <a href={INSTALL_URL} target="_blank" rel="noreferrer" className={cn(BUTTON_BASE, "border border-rule bg-transparent text-phosphor hover:border-hedge hover:text-hedge")}>
        Install MetaMask
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
          <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        {showConnectError && (
          <span className="hidden font-mono text-[11px] tracking-[0.06em] text-loss sm:inline" title={connectError?.message}>
            Couldn&rsquo;t connect
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
          className={showConnectError ? "border-loss text-loss hover:border-loss hover:text-loss" : undefined}
        >
          {isConnecting ? (
            <>
              <Spinner /> Connecting&hellip;
            </>
          ) : showConnectError ? (
            "Try again"
          ) : (
            "Connect wallet"
          )}
        </Button>
      </div>
    );
  }

  // Connected (correct or wrong network).
  return (
    <div className="flex items-center gap-2">
      {wrongNetwork && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => switchChain({ chainId: TARGET.id })}
          disabled={isSwitching}
          className="border-drift text-drift hover:border-drift hover:text-drift hover:brightness-110"
          aria-label={`Switch network to ${TARGET.name}`}
        >
          {isSwitching ? (
            <>
              <Spinner /> Switching&hellip;
            </>
          ) : (
            <>Switch to {TARGET.name}</>
          )}
        </Button>
      )}
      <AccountMenu
        address={address as string}
        tone={wrongNetwork ? "drift" : "hedge"}
        onDisconnect={() => disconnect()}
      />
    </div>
  );
}

/** Truncated-address trigger + a small menu: copy address, view on explorer, disconnect. */
function AccountMenu({
  address,
  tone,
  onDisconnect,
}: {
  address: string;
  tone: "hedge" | "drift";
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside pointer + Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently ignore, the address stays visible to copy manually */
    }
  }, [address]);

  const explorer = `${TARGET.blockExplorers?.default.url}/address/${address}`;

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        // Address is hex — keep it lowercase (override Button's uppercase), tighten tracking.
        className="normal-case tracking-[0.04em]"
      >
        <StatusDot tone={tone} />
        <span className="tabular-nums">{truncate(address)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn(ICON, "transition-transform", open && "rotate-180")} aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Wallet"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[200px] overflow-hidden rounded border border-rule bg-panel py-1 shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
        >
          <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
            {TARGET.name}
          </p>
          <MenuItem onClick={copy}>
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn(ICON, "text-hedge")} aria-hidden>
                  <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-hedge">Copied</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
                </svg>
                Copy address
              </>
            )}
          </MenuItem>
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] tracking-[0.04em] text-phosphor transition-colors hover:bg-rule hover:text-hedge focus-visible:bg-rule focus-visible:text-hedge focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View on explorer
          </a>
          <div className="my-1 h-px bg-rule" />
          <MenuItem
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
            tone="loss"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Disconnect
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "loss";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] tracking-[0.04em] transition-colors",
        "focus-visible:outline-none",
        tone === "loss"
          ? "text-loss hover:bg-rule focus-visible:bg-rule"
          : "text-phosphor hover:bg-rule hover:text-hedge focus-visible:bg-rule focus-visible:text-hedge",
      )}
    >
      {children}
    </button>
  );
}

export default ConnectButton;
