import { StatusRail } from "@/components/ui";
import { LaunchAppButton } from "@/components/LaunchAppButton";

/**
 * Marketing chrome (route group "(marketing)", served at "/").
 * Brochure-mode StatusRail: wordmark + a single "Launch app" action. No live
 * wallet/network status here — that belongs to the app surface under /app.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-phosphor">
      <StatusRail mode="brochure" actions={<LaunchAppButton />} />
      {children}
    </div>
  );
}
