import { describe, expect, it } from "vitest";
import { DEFAULT_BLOG_CONFIG, resolveBlogConfig } from "@/lib/blog-config";

describe("resolveBlogConfig", () => {
  it("defaults submission protocols to a disabled indexnow config", () => {
    expect(DEFAULT_BLOG_CONFIG.seo.submissionProtocols?.indexNow).toEqual({
      enabled: false,
      apiKey: "",
    });
  });

  it("falls back to the light public theme when the setting is missing", () => {
    const resolved = resolveBlogConfig({
      siteName: "Supportsheep",
    });

    expect(resolved.publicAppearance?.themeMode).toBe("light");
  });

  it("defaults the public top banner config when the setting is missing", () => {
    const resolved = resolveBlogConfig({
      siteName: "Supportsheep",
    });

    expect(resolved.publicAppearance?.topBanner).toEqual({
      enabled: false,
      message:
        "This content is AI-assisted and reviewed by humans where applicable",
      backgroundColor: "#FFF4D6",
      textColor: "#5F370E",
      scope: "homepage",
    });
  });

  it("defaults public shell branding config when the setting is missing", () => {
    const resolved = resolveBlogConfig({
      siteName: "Supportsheep",
    });

    expect(resolved.publicAppearance?.header).toEqual({
      logoUrl: null,
      text: "",
      backgroundColor: "#1d1133",
      textColor: "#FFFFFF",
    });
    expect(resolved.publicAppearance?.footer).toEqual({
      logoUrl: null,
      text: "",
      backgroundColor: "#171325",
      textColor: "#FFFFFF",
    });
  });

  it("defaults public article appearance when the setting is missing", () => {
    const resolved = resolveBlogConfig({
      siteName: "Supportsheep",
    });

    expect(resolved.publicAppearance?.article).toEqual({
      cards: {
        borderRadiusPreset: "soft",
        borderRadius: "",
        shadowPreset: "none",
        hoverStyle: "border",
      },
      readingLayout: {
        contentWidthPreset: "standard",
        contentWidth: "",
        bodyLineHeightPreset: "balanced",
        bodyLineHeight: "",
        summaryBoxStyle: "outlined",
      },
      tableOfContents: {
        enabled: true,
        stylePreset: "bordered",
      },
      typography: {
        fontPreset: "default",
        headingScalePreset: "balanced",
      },
    });
  });

  it("preserves explicit public top banner overrides", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        themeMode: "dark",
        topBanner: {
          enabled: true,
          message: "Reviewed by editors",
          backgroundColor: "#111111",
          textColor: "#F9F9F9",
          scope: "all",
        },
      },
    });

    expect(resolved.publicAppearance?.topBanner).toEqual({
      enabled: true,
      message: "Reviewed by editors",
      backgroundColor: "#111111",
      textColor: "#F9F9F9",
      scope: "all",
    });
  });

  it("backfills legacy null banner values to defaults", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: null,
          backgroundColor: null,
          textColor: null,
          scope: null,
        },
      },
    });

    expect(resolved.publicAppearance?.topBanner?.message).toBe(
      DEFAULT_BLOG_CONFIG.publicAppearance?.topBanner?.message,
    );
    expect(resolved.publicAppearance?.topBanner?.scope).toBe(
      DEFAULT_BLOG_CONFIG.publicAppearance?.topBanner?.scope,
    );
    expect(resolved.publicAppearance?.topBanner?.backgroundColor).toBe(
      DEFAULT_BLOG_CONFIG.publicAppearance?.topBanner?.backgroundColor,
    );
    expect(resolved.publicAppearance?.topBanner?.textColor).toBe(
      DEFAULT_BLOG_CONFIG.publicAppearance?.topBanner?.textColor,
    );
  });

  it("backfills legacy null public shell branding values to defaults", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        header: {
          logoUrl: null,
          text: null,
          backgroundColor: null,
          textColor: null,
        },
        footer: {
          logoUrl: null,
          text: null,
          backgroundColor: null,
          textColor: null,
        },
      },
    });

    expect(resolved.publicAppearance?.header).toEqual({
      logoUrl: null,
      text: "",
      backgroundColor: "#1d1133",
      textColor: "#FFFFFF",
    });
    expect(resolved.publicAppearance?.footer).toEqual({
      logoUrl: null,
      text: "",
      backgroundColor: "#171325",
      textColor: "#FFFFFF",
    });
  });

  it("backfills legacy null public article values to defaults", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        article: {
          cards: {
            borderRadiusPreset: null,
            borderRadius: null,
            shadowPreset: null,
            hoverStyle: null,
          },
          readingLayout: {
            contentWidthPreset: null,
            contentWidth: null,
            bodyLineHeightPreset: null,
            bodyLineHeight: null,
            summaryBoxStyle: null,
          },
          tableOfContents: {
            enabled: null,
            stylePreset: null,
          },
          typography: {
            fontPreset: null,
            headingScalePreset: null,
          },
        },
      },
    });

    expect(resolved.publicAppearance?.article).toEqual({
      cards: {
        borderRadiusPreset: "soft",
        borderRadius: "",
        shadowPreset: "none",
        hoverStyle: "border",
      },
      readingLayout: {
        contentWidthPreset: "standard",
        contentWidth: "",
        bodyLineHeightPreset: "balanced",
        bodyLineHeight: "",
        summaryBoxStyle: "outlined",
      },
      tableOfContents: {
        enabled: true,
        stylePreset: "bordered",
      },
      typography: {
        fontPreset: "default",
        headingScalePreset: "balanced",
      },
    });
  });

  it("preserves explicit public article appearance overrides", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        article: {
          cards: {
            borderRadiusPreset: "sharp",
            borderRadius: "12px",
            shadowPreset: "subtle",
            hoverStyle: "lift",
          },
          readingLayout: {
            contentWidthPreset: "wide",
            contentWidth: "72ch",
            bodyLineHeightPreset: "airy",
            bodyLineHeight: "1.8",
            summaryBoxStyle: "filled",
          },
          tableOfContents: {
            enabled: false,
            stylePreset: "card",
          },
          typography: {
            fontPreset: "editorial",
            headingScalePreset: "display",
          },
        },
      },
    });

    expect(resolved.publicAppearance?.article).toEqual({
      cards: {
        borderRadiusPreset: "sharp",
        borderRadius: "12px",
        shadowPreset: "subtle",
        hoverStyle: "lift",
      },
      readingLayout: {
        contentWidthPreset: "wide",
        contentWidth: "72ch",
        bodyLineHeightPreset: "airy",
        bodyLineHeight: "1.8",
        summaryBoxStyle: "filled",
      },
      tableOfContents: {
        enabled: false,
        stylePreset: "card",
      },
      typography: {
        fontPreset: "editorial",
        headingScalePreset: "display",
      },
    });
  });

  it("preserves explicit public theme overrides", () => {
    const resolved = resolveBlogConfig({
      publicAppearance: {
        themeMode: "dark",
      },
    });

    expect(resolved.publicAppearance?.themeMode).toBe("dark");
    expect(resolved.homepage).toEqual(DEFAULT_BLOG_CONFIG.homepage);
  });

  it("preserves explicit indexnow overrides", () => {
    const resolved = resolveBlogConfig({
      seo: {
        defaultMetaTitle: "Supportsheep",
        defaultMetaDescription: "A modern blog",
        googleAnalyticsId: "",
        clarityId: "",
        submissionProtocols: {
          indexNow: {
            enabled: true,
            apiKey: "abc123",
          },
        },
      },
    });

    expect(resolved.seo.submissionProtocols?.indexNow).toEqual({
      enabled: true,
      apiKey: "abc123",
    });
  });

  it("defaults the analytics GA4 measurement id to empty when missing", () => {
    const resolved = resolveBlogConfig({ siteName: "Supportsheep" });
    expect(resolved.analytics?.gaMeasurementId).toBe("");
  });

  it("preserves an explicit analytics GA4 measurement id override", () => {
    const resolved = resolveBlogConfig({
      analytics: { gaMeasurementId: "G-ABC12345" },
    });
    expect(resolved.analytics?.gaMeasurementId).toBe("G-ABC12345");
  });

  it("defaults the interview workspace configuration when missing", () => {
    const resolved = resolveBlogConfig({
      siteName: "Supportsheep",
    });

    expect(resolved.interview).toEqual({
      defaultStyle: "smart",
      defaultDurationSec: 300,
      defaultRecording: "transcript",
      whoCanMintLinks: ["owner", "admin", "editor"],
      monthlyCostCapUsd: null,
      retention: {
        audioDays: 90,
        transcriptDays: 365,
      },
      defaultLanguage: "en",
    });
  });

  it("preserves explicit interview workspace configuration overrides", () => {
    const resolved = resolveBlogConfig({
      interview: {
        defaultStyle: "case_study",
        defaultDurationSec: 600,
        defaultRecording: "audio",
        whoCanMintLinks: ["owner", "admin"],
        monthlyCostCapUsd: 150,
        retention: {
          audioDays: 30,
          transcriptDays: 180,
        },
        defaultLanguage: "fr",
      },
    });

    expect(resolved.interview).toEqual({
      defaultStyle: "case_study",
      defaultDurationSec: 600,
      defaultRecording: "audio",
      whoCanMintLinks: ["owner", "admin"],
      monthlyCostCapUsd: 150,
      retention: {
        audioDays: 30,
        transcriptDays: 180,
      },
      defaultLanguage: "fr",
    });
  });
});
