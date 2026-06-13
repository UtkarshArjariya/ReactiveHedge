"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Client providers for the APP surface only (route group "(app)", served at /app).
 * WagmiProvider (wallet/account state) + QueryClientProvider (wagmi's async cache).
 *
 * Deliberately NOT mounted in the marketing layout — "/" stays provider-free so no
 * wallet code ships on the brochure pages. WagmiProvider reconnects on mount by
 * default, which restores a previously-connected wallet after a refresh.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // One QueryClient per mount, kept stable across re-renders (App Router pattern).
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default AppProviders;
