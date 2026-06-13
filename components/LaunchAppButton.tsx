"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Trace } from "./Trace";

const TRANSITION_MS = 360; // deliberate but quick — kept under ~400ms.

/**
 * The "/" → "/app" hand-off. On click it drops a full-bleed ink veil with the
 * signature Trace settling into its converged (protected) state, then routes to
 * the app. Reduced motion skips the veil and navigates immediately.
 */
export function LaunchAppButton() {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  // Warm the app route so the navigation lands the moment the veil clears.
  useEffect(() => {
    router.prefetch("/app");
  }, [router]);

  const launch = useCallback(() => {
    if (launching) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      router.push("/app");
      return;
    }

    setLaunching(true);
    window.setTimeout(() => router.push("/app"), TRANSITION_MS);
  }, [launching, router]);

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={launch}
        disabled={launching}
        aria-label="Launch the ReactiveHedge app"
      >
        Launch app
      </Button>

      {launching && (
        <div className="launch-veil" role="status" aria-live="polite">
          <div className="launch-veil__inner">
            <Trace animate={false} state="converged" height={120} />
            <span className="launch-veil__label">Entering monitor…</span>
          </div>
        </div>
      )}
    </>
  );
}

export default LaunchAppButton;
