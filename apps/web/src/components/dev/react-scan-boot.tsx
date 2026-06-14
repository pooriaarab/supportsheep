"use client";

import { useMountEffect } from "@/hooks/use-mount-effect";

/**
 * Boots the react-scan dev overlay to visualise render churn in the browser.
 * Renders nothing and is a no-op outside `NODE_ENV=development`. The
 * `react-scan` module is imported dynamically so production bundles never
 * include it.
 */
export function ReactScanBoot() {
  useMountEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void import("react-scan")
      .then(({ scan }) => {
        scan({ enabled: true, log: false });
      })
      .catch(() => {
        // react-scan is optional in dev; ignore boot failures
      });
  });
  return null;
}
