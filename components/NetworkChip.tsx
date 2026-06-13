"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { unichainSepolia } from "@/lib/chains";
import { Chip } from "@/components/ui";

const TARGET = unichainSepolia;

/**
 * Live network readout for the StatusRail (instrument mode). Reflects the wallet's
 * actual chain so the rail's network chip tracks connection state:
 *   - disconnected → neutral "Unichain Sepolia · 1301" (the pool's chain, no pulse)
 *   - connected, right chain → mint, pulsing (we're monitoring the right place)
 *   - connected, wrong chain → amber "Wrong network · <id>" (action needed)
 *
 * Gated on mount so the first client render matches SSR (always disconnected) and
 * there's no hydration flash. Hidden below `sm`, matching the rail's other chips.
 */
export function NetworkChip() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { isConnected, chainId } = useAccount();

  // Pre-mount / SSR: render the neutral target chip (matches the disconnected state).
  const connectedRight = mounted && isConnected && chainId === TARGET.id;
  const connectedWrong = mounted && isConnected && chainId !== TARGET.id;

  if (connectedWrong) {
    return (
      <Chip tone="drift" dot className="hidden sm:inline-flex" aria-label={`Wallet on wrong network, chain ${chainId}`}>
        Wrong network <span className="text-ash">·</span> {chainId}
      </Chip>
    );
  }

  return (
    <Chip
      tone={connectedRight ? "hedge" : "default"}
      dot={connectedRight}
      className="hidden sm:inline-flex"
      aria-label={`Network ${TARGET.name}, chain ${TARGET.id}`}
    >
      {TARGET.name} <span className="text-ash">·</span> {TARGET.id}
    </Chip>
  );
}

export default NetworkChip;
