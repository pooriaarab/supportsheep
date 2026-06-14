import { afterEach, describe, expect, it, vi } from "vitest";
import { trackAnalyticsEvent, trackPageView } from "@/lib/analytics/events";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

describe("trackAnalyticsEvent", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("does nothing when gtag is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    expect(() =>
      trackAnalyticsEvent("blog_search", { search_term: "seo" }),
    ).not.toThrow();
  });

  it("forwards event name and params to gtag", () => {
    const gtag = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { gtag },
    });

    trackAnalyticsEvent("blog_search", {
      search_term: "seo",
      result_count: 3,
    });

    expect(gtag).toHaveBeenCalledWith("event", "blog_search", {
      search_term: "seo",
      result_count: 3,
    });
  });
});

describe("trackPageView", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
  });

  it("does nothing when gtag is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://example.com/foo" } },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { title: "Foo" },
    });

    expect(() => trackPageView("/foo")).not.toThrow();
  });

  it("sends a page_view EVENT (not a config call) with path, location and title", () => {
    const gtag = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { gtag, location: { href: "https://example.com/foo?x=1" } },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { title: "Foo Post" },
    });

    trackPageView("/foo?x=1");

    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/foo?x=1",
      page_location: "https://example.com/foo?x=1",
      page_title: "Foo Post",
    });
    expect(gtag).not.toHaveBeenCalledWith(
      "config",
      expect.anything(),
      expect.anything(),
    );
  });
});
