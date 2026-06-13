// Client-side wagmi config — for USER-SIGNED actions in the browser only.
//
// This is deliberately separate from lib/server.ts: the live chain *reads* run
// server-side through the route handlers (/api/state, /api/events) on a possibly
// private RPC, while this config drives wallet connect + transactions from the
// browser. It only ever touches the PUBLIC chain RPC (lib/chains.ts, which reads
// NEXT_PUBLIC_* / public fallbacks) — no server RPC URL is exposed here.
//
// Wallet strategy: the `injected()` connector plus wagmi's built-in EIP-6963
// multi-injected-provider discovery (on by default). That picks up MetaMask (and
// any other injected wallet) with NO WalletConnect projectId — "MetaMask for now".
// A polished multi-wallet modal (RainbowKit / Reown AppKit) can later sit on top
// of this exact config without changing it.

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { unichainSepolia } from "./chains";

export const wagmiConfig = createConfig({
  // The chain the LP actually transacts on. Add more here only if the user signs on them.
  chains: [unichainSepolia],
  connectors: [injected()],
  transports: {
    // No URL → uses unichainSepolia.rpcUrls.default (public / NEXT_PUBLIC_*), never the server RPC.
    [unichainSepolia.id]: http(),
  },
  // App Router pattern: config lives in a client provider and `ssr: true` keeps
  // wagmi from reading wallet storage during SSR, which is what prevents the
  // hydration mismatch. Reconnect-on-mount (default) restores a prior session.
  ssr: true,
});

// Make wagmi's hooks strongly typed against this config across the app.
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
