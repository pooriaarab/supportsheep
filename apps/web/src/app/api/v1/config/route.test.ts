import { describe, expect, it } from "vitest";
import { DEFAULT_BLOG_CONFIG } from "@/lib/blog-config";
import {
  flattenBlogConfigPayload,
  getResolvedTopBannerValidationError,
  HEX_COLOR_REQUIRED,
  resolvePatchedBlogConfigFromFlat,
  TOP_BANNER_BACKGROUND_COLOR_REQUIRED,
  TOP_BANNER_SCOPE_REQUIRED,
  TOP_BANNER_TEXT_COLOR_REQUIRED,
  TOP_BANNER_MESSAGE_LENGTH_REQUIRED,
  updateBlogConfigSchema,
} from "@/app/api/v1/config/route";

describe("updateBlogConfigSchema", () => {
  it("accepts submission protocol updates for indexnow", () => {
    const result = updateBlogConfigSchema.safeParse({
      seo: {
        submissionProtocols: {
          indexNow: {
            enabled: true,
            apiKey: "abc123",
          },
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid GA4 measurement id", () => {
    const result = updateBlogConfigSchema.safeParse({
      analytics: { gaMeasurementId: "G-ABC12345" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty GA4 measurement id (disables the tag)", () => {
    const result = updateBlogConfigSchema.safeParse({
      analytics: { gaMeasurementId: "" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed GA4 measurement id", () => {
    const result = updateBlogConfigSchema.safeParse({
      analytics: { gaMeasurementId: "UA-12345-6" },
    });
    expect(result.success).toBe(false);
  });

  it("allows enabling the banner in a partial payload", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        topBanner: {
          enabled: true,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects top banner messages longer than 280 characters", () => {
    const longMessage = "a".repeat(281);
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        topBanner: {
          message: longMessage,
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("message"),
    );
    expect(issue?.message).toBe(TOP_BANNER_MESSAGE_LENGTH_REQUIRED);
  });

  it("rejects invalid banner background color payloads", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        topBanner: {
          backgroundColor: "short",
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("backgroundColor"),
    );
    expect(issue?.message).toBe(TOP_BANNER_BACKGROUND_COLOR_REQUIRED);
  });

  it("rejects invalid banner text color payloads", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        topBanner: {
          textColor: "blue",
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("textColor"),
    );
    expect(issue?.message).toBe(TOP_BANNER_TEXT_COLOR_REQUIRED);
  });

  it("rejects invalid banner scope payloads", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        topBanner: {
          scope: "invalid",
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("scope"),
    );
    expect(issue?.message).toBe(TOP_BANNER_SCOPE_REQUIRED);
  });

  it("accepts nested public shell branding payloads", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        header: {
          logoUrl: "https://storage.googleapis.com/example/header.png",
          text: "Acme",
          backgroundColor: "#1d1133",
          textColor: "#FFFFFF",
        },
        footer: {
          logoUrl: null,
          text: "Acme Footer",
          backgroundColor: "#171325",
          textColor: "#F5F5F5",
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid public shell branding colors", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        header: {
          backgroundColor: "purple",
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("backgroundColor"),
    );
    expect(issue?.message).toBe(HEX_COLOR_REQUIRED);
  });

  it("accepts nested public article appearance payloads", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        article: {
          cards: {
            borderRadiusPreset: "sharp",
            borderRadius: "10px",
            shadowPreset: "none",
            hoverStyle: "border",
          },
          readingLayout: {
            contentWidthPreset: "wide",
            contentWidth: "72ch",
            bodyLineHeightPreset: "airy",
            bodyLineHeight: "1.8",
            summaryBoxStyle: "minimal",
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

    expect(result.success).toBe(true);
  });

  it("rejects invalid public article appearance overrides", () => {
    const result = updateBlogConfigSchema.safeParse({
      publicAppearance: {
        article: {
          cards: {
            borderRadius: "calc(10px + 2rem)",
          },
        },
      },
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) =>
      i.path.includes("borderRadius"),
    );
    expect(issue?.message).toBe(
      "Border radius override must be a px or rem value",
    );
  });

  it("inherits the default top banner message when enabling via a partial patch", () => {
    const payload = {
      publicAppearance: {
        topBanner: {
          enabled: true,
        },
      },
    };

    const updateData = flattenBlogConfigPayload(
      payload as Record<string, unknown>,
    );
    const resolved = resolvePatchedBlogConfigFromFlat(undefined, updateData);

    expect(resolved.publicAppearance?.topBanner?.enabled).toBe(true);
    expect(resolved.publicAppearance?.topBanner?.message).toBe(
      DEFAULT_BLOG_CONFIG.publicAppearance?.topBanner?.message,
    );
  });

  it("flags an empty trimmed banner message in the resolved payload", () => {
    const payload = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "    ",
        },
      },
    };

    const updateData = flattenBlogConfigPayload(
      payload as Record<string, unknown>,
    );
    const resolved = resolvePatchedBlogConfigFromFlat(
      DEFAULT_BLOG_CONFIG as unknown as Record<string, unknown>,
      updateData,
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.message",
      message: "Banner message is required when the banner is enabled",
    });
  });

  it("flags an invalid resolved banner background color", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "Test banner",
          backgroundColor: "#GGGGGG",
          textColor: "#5F370E",
          scope: "all",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.backgroundColor",
      message: TOP_BANNER_BACKGROUND_COLOR_REQUIRED,
    });
  });

  it("flags an empty resolved banner background color", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "Test banner",
          backgroundColor: "",
          textColor: "#5F370E",
          scope: "all",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.backgroundColor",
      message: TOP_BANNER_BACKGROUND_COLOR_REQUIRED,
    });
  });

  it("flags an invalid resolved banner text color", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "Test banner",
          backgroundColor: "#FFF4D6",
          textColor: "red",
          scope: "all",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.textColor",
      message: TOP_BANNER_TEXT_COLOR_REQUIRED,
    });
  });

  it("flags a resolved banner message that exceeds the length limit", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "a".repeat(281),
          backgroundColor: "#FFF4D6",
          textColor: "#5F370E",
          scope: "homepage",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.message",
      message: TOP_BANNER_MESSAGE_LENGTH_REQUIRED,
    });
  });

  it("flags a resolved banner with an invalid scope value", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "Test banner",
          backgroundColor: "#FFF4D6",
          textColor: "#5F370E",
          scope: "",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.scope",
      message: TOP_BANNER_SCOPE_REQUIRED,
    });
  });

  it("flags an empty resolved banner text color", () => {
    const existingInvalid = {
      publicAppearance: {
        topBanner: {
          enabled: true,
          message: "Test banner",
          backgroundColor: "#FFF4D6",
          textColor: "",
          scope: "all",
        },
      },
    };

    const resolved = resolvePatchedBlogConfigFromFlat(
      existingInvalid as Record<string, unknown>,
      {},
    );

    expect(
      getResolvedTopBannerValidationError(
        resolved.publicAppearance?.topBanner,
      ),
    ).toEqual({
      field: "publicAppearance.topBanner.textColor",
      message: TOP_BANNER_TEXT_COLOR_REQUIRED,
    });
  });

  it("accepts valid interview configurations in updateBlogConfigSchema", () => {
    const result = updateBlogConfigSchema.safeParse({
      interview: {
        defaultStyle: "case_study",
        defaultDurationSec: 600,
        defaultRecording: "audio",
        whoCanMintLinks: ["owner", "admin"],
        monthlyCostCapUsd: 250,
        retention: {
          audioDays: 60,
          transcriptDays: 180,
        },
        defaultLanguage: "es",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid interview values in updateBlogConfigSchema", () => {
    const result = updateBlogConfigSchema.safeParse({
      interview: {
        defaultStyle: "invalid_style",
        defaultDurationSec: -100,
        whoCanMintLinks: ["invalid_role"],
        defaultLanguage: "invalid_language",
      },
    });

    expect(result.success).toBe(false);
  });
});
