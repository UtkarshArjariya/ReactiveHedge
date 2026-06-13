import { StatusRail } from "@/components/ui";
import { AppProviders } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";
import { NetworkChip } from "@/components/NetworkChip";

/**
 * App chrome (route group "(app)"). Instrument-mode StatusRail: a live, wallet-aware
 * network chip, monitoring pulse, ticking block readout, plus the real wallet connect
 * control. Wrapped in AppProviders (wagmi + react-query) so wallet code ships ONLY on
 * the app surface — the marketing layout stays provider-free.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="min-h-screen bg-ink text-phosphor">
        <StatusRail mode="instrument" networkSlot={<NetworkChip />} actions={<ConnectButton />} />
        {children}
      </div>
    </AppProviders>
  );
}
