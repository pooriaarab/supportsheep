"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { trackAnalyticsEvent, trackPageView } from "@/lib/analytics/events";
import {
  normalizeGoogleAnalyticsMeasurementId,
  serializeGoogleAnalyticsMeasurementIdForScript,
} from "@/lib/integrations/google-integration";

interface GoogleAnalyticsProps {
  measurementId: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function buildCurrentPath(pathname: string): string {
  if (typeof window === "undefined") {
    return pathname;
  }
  return `${pathname}${window.location.search}`;
}

function ensureGtagQueue() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    }) as unknown as NonNullable<typeof window.gtag>;
  }
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const normalizedMeasurementId =
    normalizeGoogleAnalyticsMeasurementId(measurementId);

  useMountEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!anchor?.href) {
        return;
      }

      const href = new URL(anchor.href);
      if (href.origin === window.location.origin) {
        return;
      }

      trackAnalyticsEvent("outbound_link_click", {
        link_url: href.toString(),
        link_domain: href.hostname,
      });
    }

    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  });

  if (!normalizedMeasurementId) {
    return null;
  }

  const serializedMeasurementId =
    serializeGoogleAnalyticsMeasurementIdForScript(normalizedMeasurementId);

  return (
    <>
      <GoogleAnalyticsPageView
        key={`${normalizedMeasurementId}:${pathname}`}
        pathname={pathname}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          normalizedMeasurementId,
        )}`}
        strategy="afterInteractive"
      />
      <Script
        id={`ga4-init-${normalizedMeasurementId}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${serializedMeasurementId}, { send_page_view: false });
`,
        }}
      />
    </>
  );
}

function GoogleAnalyticsPageView({ pathname }: { pathname: string }) {
  useMountEffect(() => {
    // Ensure the gtag queue exists, then send a real `page_view` EVENT. A
    // second `gtag('config', …)` does NOT emit a page view, which is why the
    // blog recorded zero pageviews despite sessions being tracked.
    ensureGtagQueue();
    trackPageView(buildCurrentPath(pathname));
  });

  return null;
}
