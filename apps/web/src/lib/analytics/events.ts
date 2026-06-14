export type AnalyticsEventParams = Record<string, string | number | boolean>;

type GtagFn = (
  command: "event" | "config" | "js",
  target: string | Date,
  params?: AnalyticsEventParams,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsEventParams = {},
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, params);
}

/**
 * Send a GA4 `page_view` event for the current route.
 *
 * GA4 only records a page view from an explicit `page_view` *event* (or a
 * `config` call that hasn't opted out of the automatic view). We init the tag
 * with `send_page_view: false` and drive views from here so SPA route changes
 * are counted — a second `gtag('config', …)` call does NOT emit a page view, so
 * this MUST be an event, exactly like every other tracked event.
 */
export function trackPageView(pagePath: string): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.gtag !== "function"
  ) {
    return;
  }

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}
