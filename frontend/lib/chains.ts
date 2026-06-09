import { defineChain } from "viem";

const env = (k: string, fallback: string) =>
  (process.env[k] && process.env[k]!.length > 0 ? process.env[k]! : fallback);

export const unichainSepolia = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env("NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC", "https://sepolia.unichain.org")] } },
  blockExplorers: { default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" } },
  testnet: true,
});

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env("NEXT_PUBLIC_BASE_SEPOLIA_RPC", "https://sepolia.base.org")] } },
  blockExplorers: { default: { name: "Basescan", url: "https://sepolia.basescan.org" } },
  testnet: true,
});

export const reactiveLasna = defineChain({
  id: 5318007,
  name: "Reactive Lasna",
  nativeCurrency: { name: "REACT", symbol: "REACT", decimals: 18 },
  rpcUrls: { default: { http: [env("NEXT_PUBLIC_REACTIVE_LASNA_RPC", "https://lasna-rpc.rnk.dev/")] } },
  blockExplorers: { default: { name: "Reactscan", url: "https://lasna.reactscan.net" } },
  testnet: true,
});
