/**
 * Blog Config API
 *
 * GET /api/v1/config -- Read blog_config/settings
 * PATCH /api/v1/config -- Update blog config settings
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import type { BlogConfig, PublicTopBannerConfig } from "@repo/types";
import {
  getBlogConfig,
  getStoredBlogConfig,
  resolveBlogConfig,
  updateBlogConfig,
} from "@/lib/blog-config";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const GA4_MEASUREMENT_ID_REGEX = /^G-[A-Z0-9]+$/;

export const GA_MEASUREMENT_ID_REQUIRED =
  "Google Analytics Measurement ID must look like G-XXXXXXXXXX";

export const TOP_BANNER_MESSAGE_REQUIRED =
  "Banner message is required when the banner is enabled";
export const TOP_BANNER_MESSAGE_LENGTH_REQUIRED =
  "Banner message must be 280 characters or fewer";
export const TOP_BANNER_BACKGROUND_COLOR_REQUIRED =
  "Banner background color must be a 6-digit hex value";
export const TOP_BANNER_TEXT_COLOR_REQUIRED =
  "Banner text color must be a 6-digit hex value";
export const TOP_BANNER_SCOPE_REQUIRED =
  "Banner scope must be either homepage or all";

export const HEX_COLOR_REQUIRED = "Color must be a 6-digit hex value";
export const ARTICLE_RADIUS_REQUIRED =
  "Border radius override must be a px or rem value";
export const ARTICLE_CONTENT_WIDTH_REQUIRED =
  "Content width override must be a px, rem, %, ch, or vw value";
export const ARTICLE_LINE_HEIGHT_REQUIRED =
  "Line height override must be unitless, rem, or %";

const TOP_BANNER_MESSAGE_FIELD = "publicAppearance.topBanner.message";
const TOP_BANNER_BACKGROUND_COLOR_FIELD =
  "publicAppearance.topBanner.backgroundColor";
const TOP_BANNER_TEXT_COLOR_FIELD = "publicAppearance.topBanner.textColor";
const TOP_BANNER_SCOPE_FIELD = "publicAppearance.topBanner.scope";

const scopeEnum = z.enum(["homepage", "all"], TOP_BANNER_SCOPE_REQUIRED);
const articleRadiusPresetEnum = z.enum(["sharp", "soft", "round"]);
const articleShadowPresetEnum = z.enum(["none", "subtle", "elevated"]);
const articleHoverStyleEnum = z.enum(["none", "border", "lift"]);
const articleWidthPresetEnum = z.enum(["narrow", "standard", "wide"]);
const articleLineHeightPresetEnum = z.enum(["compact", "balanced", "airy"]);
const articleSummaryBoxStyleEnum = z.enum(["minimal", "outlined", "filled"]);
const articleTocStylePresetEnum = z.enum(["minimal", "card", "bordered"]);
const articleFontPresetEnum = z.enum(["default", "editorial", "modern"]);
const articleHeadingScalePresetEnum = z.enum(["compact", "balanced", "display"]);

const CSS_PX_OR_REM_VALUE_REGEX = /^\d+(?:\.\d+)?(?:px|rem)$/;
const CSS_CONTENT_WIDTH_VALUE_REGEX = /^\d+(?:\.\d+)?(?:px|rem|%|ch|vw)$/;
const CSS_LINE_HEIGHT_VALUE_REGEX = /^(?:\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:rem|%))$/;

function optionalOverrideSchema(
  regex: RegExp,
  message: string,
) {
  return z.string().refine((value) => value === "" || regex.test(value), {
    message,
  }).optional();
}

const topBannerSchema = z.object({
  enabled: z.boolean().optional(),
  message: z
    .string()
    .max(280, { message: TOP_BANNER_MESSAGE_LENGTH_REQUIRED })
    .optional(),
  backgroundColor: z.string().regex(HEX_COLOR_REGEX, {
    message: TOP_BANNER_BACKGROUND_COLOR_REQUIRED,
  }).optional(),
  textColor: z.string().regex(HEX_COLOR_REGEX, {
    message: TOP_BANNER_TEXT_COLOR_REQUIRED,
  }).optional(),
  scope: scopeEnum.optional(),
});

const shellSectionSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  text: z.string().max(100).optional(),
  backgroundColor: z.string().regex(HEX_COLOR_REGEX, {
    message: HEX_COLOR_REQUIRED,
  }).optional(),
  textColor: z.string().regex(HEX_COLOR_REGEX, {
    message: HEX_COLOR_REQUIRED,
  }).optional(),
});

const articleCardsSchema = z.object({
  borderRadiusPreset: articleRadiusPresetEnum.optional(),
  borderRadius: optionalOverrideSchema(
    CSS_PX_OR_REM_VALUE_REGEX,
    ARTICLE_RADIUS_REQUIRED,
  ),
  shadowPreset: articleShadowPresetEnum.optional(),
  hoverStyle: articleHoverStyleEnum.optional(),
});

const articleReadingLayoutSchema = z.object({
  contentWidthPreset: articleWidthPresetEnum.optional(),
  contentWidth: optionalOverrideSchema(
    CSS_CONTENT_WIDTH_VALUE_REGEX,
    ARTICLE_CONTENT_WIDTH_REQUIRED,
  ),
  bodyLineHeightPreset: articleLineHeightPresetEnum.optional(),
  bodyLineHeight: optionalOverrideSchema(
    CSS_LINE_HEIGHT_VALUE_REGEX,
    ARTICLE_LINE_HEIGHT_REQUIRED,
  ),
  summaryBoxStyle: articleSummaryBoxStyleEnum.optional(),
});

const articleTableOfContentsSchema = z.object({
  enabled: z.boolean().optional(),
  stylePreset: articleTocStylePresetEnum.optional(),
});

const articleTypographySchema = z.object({
  fontPreset: articleFontPresetEnum.optional(),
  headingScalePreset: articleHeadingScalePresetEnum.optional(),
});

const articleAppearanceSchema = z.object({
  cards: articleCardsSchema.optional(),
  readingLayout: articleReadingLayoutSchema.optional(),
  tableOfContents: articleTableOfContentsSchema.optional(),
  typography: articleTypographySchema.optional(),
});

const httpsUrlSchema = z.string().url().refine(
  (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must use https://" },
);

const freeToolsConfigSchema = z.object({
  indexEnabled: z.boolean().optional(),
  defaultCta: z
    .object({
      label: z.string().min(1).max(80).optional(),
      url: httpsUrlSchema.optional(),
    })
    .optional(),
  defaultCallout: z
    .object({
      enabled: z.boolean().optional(),
      heading: z.string().min(1).max(120).optional(),
      body: z.string().min(1).max(500).optional(),
      primaryLabel: z.string().min(1).max(80).optional(),
      primaryBaseUrl: httpsUrlSchema.optional(),
      secondaryLabel: z.string().max(80).optional(),
      secondaryBaseUrl: httpsUrlSchema.optional(),
      utmSource: z.string().max(80).optional(),
      utmMedium: z.string().max(80).optional(),
      utmCampaign: z.string().max(120).optional(),
      utmContent: z.string().max(120).optional(),
      utmTerm: z.string().max(120).optional(),
    })
    .optional(),
  defaultAiDailyLimit: z.number().int().min(0).max(1000).optional(),
  defaultNonAiMinuteLimit: z.number().int().min(1).max(10000).optional(),
});

export function flattenBlogConfigPayload(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenBlogConfigPayload(value as Record<string, unknown>, fullKey));
    } else if (value !== undefined) {
      result[fullKey] = value;
    }
  }
  return result;
}

export function applyFlatUpdates(
  base: Record<string, unknown> | undefined,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = base
    ? structuredClone(base)
    : {};

  for (const [key, value] of Object.entries(updates)) {
    const segments = key.split(".");
    let cursor = result;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = value;
  }

  return result;
}

export function resolvePatchedBlogConfigFromFlat(
  existing: Record<string, unknown> | undefined,
  updates: Record<string, unknown>,
): BlogConfig {
  const merged = applyFlatUpdates(existing, updates);
  return resolveBlogConfig(merged as Partial<BlogConfig>);
}

export type ResolvedTopBannerValidationError = {
  field: string;
  message: string;
};

export function getResolvedTopBannerValidationError(
  banner?: PublicTopBannerConfig,
): ResolvedTopBannerValidationError | undefined {
  if (banner?.enabled && !banner.message?.trim()) {
    return {
      field: TOP_BANNER_MESSAGE_FIELD,
      message: TOP_BANNER_MESSAGE_REQUIRED,
    };
  }
  if (banner?.message && banner.message.length > 280) {
    return {
      field: TOP_BANNER_MESSAGE_FIELD,
      message: TOP_BANNER_MESSAGE_LENGTH_REQUIRED,
    };
  }
  if (
    banner &&
    banner.backgroundColor !== undefined &&
    !HEX_COLOR_REGEX.test(banner.backgroundColor)
  ) {
    return {
      field: TOP_BANNER_BACKGROUND_COLOR_FIELD,
      message: TOP_BANNER_BACKGROUND_COLOR_REQUIRED,
    };
  }
  if (
    banner &&
    banner.textColor !== undefined &&
    !HEX_COLOR_REGEX.test(banner.textColor)
  ) {
    return {
      field: TOP_BANNER_TEXT_COLOR_FIELD,
      message: TOP_BANNER_TEXT_COLOR_REQUIRED,
    };
  }
  if (
    banner &&
    banner.scope != null &&
    !["homepage", "all"].includes(banner.scope)
  ) {
    return {
      field: TOP_BANNER_SCOPE_FIELD,
      message: TOP_BANNER_SCOPE_REQUIRED,
    };
  }
  return undefined;
}

export const updateBlogConfigSchema = z
  .object({
    siteName: z.string().min(1).max(100).optional(),
    siteDescription: z.string().max(500).optional(),
    logo: z.string().optional(),
    permalinks: z
      .object({
        canonicalPattern: z.literal("/<slug>/").optional(),
        redirectOldPatterns: z.boolean().optional(),
        allowedPatterns: z
          .array(
            z.enum([
              "/<slug>/",
              "/<category>/<slug>/",
              "/blog/<slug>/",
              "/blog/<category>/<slug>/",
            ]),
          )
          .optional(),
      })
      .optional(),
    publicAppearance: z
      .object({
        themeMode: z.enum(["light", "dark"]).optional(),
        topBanner: topBannerSchema.optional(),
        header: shellSectionSchema.optional(),
        footer: shellSectionSchema.optional(),
        article: articleAppearanceSchema.optional(),
      })
      .optional(),
    homepage: z
      .object({
        layout: z.enum(["grid", "sidebar", "hybrid"]).optional(),
        postsPerPage: z.number().int().min(1).max(100).optional(),
        featuredCategory: z.string().nullable().optional(),
      })
      .optional(),
    seo: z
      .object({
        defaultMetaTitle: z.string().max(100).optional(),
        defaultMetaDescription: z.string().max(300).optional(),
        googleAnalyticsId: z.string().max(50).optional(),
        clarityId: z.string().max(50).optional(),
        submissionProtocols: z
          .object({
            indexNow: z
              .object({
                enabled: z.boolean().optional(),
                apiKey: z.string().max(100).optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    ai: z
      .object({
        defaultProvider: z.enum(["claude", "gpt", "gemini"]).optional(),
        providers: z
          .object({
            claude: z
              .object({
                apiKey: z.string().optional(),
                model: z.string().optional(),
              })
              .optional(),
            gpt: z
              .object({
                apiKey: z.string().optional(),
                model: z.string().optional(),
              })
              .optional(),
            gemini: z
              .object({
                apiKey: z.string().optional(),
                model: z.string().optional(),
              })
              .optional(),
            tavus: z
              .object({
                apiKey: z.string().optional(),
                defaultAvatarId: z.string().optional(),
                defaultPersonaId: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
        defaultContextTagId: z.string().optional(),
        defaultSkillsPipeline: z.array(z.string()).optional(),
      })
      .optional(),
    analytics: z
      .object({
        gaMeasurementId: z
          .string()
          .max(50)
          .refine(
            (value) =>
              value.trim() === "" ||
              GA4_MEASUREMENT_ID_REGEX.test(value.trim().toUpperCase()),
            { message: GA_MEASUREMENT_ID_REQUIRED },
          )
          .optional(),
      })
      .optional(),
    freeTools: freeToolsConfigSchema.optional(),
    interview: z
      .object({
        defaultStyle: z
          .enum(["testimonial", "eeat", "case_study", "qa", "launch", "smart"])
          .optional(),
        defaultDurationSec: z.number().int().min(60).max(1800).optional(),
        defaultRecording: z.enum(["transcript", "audio", "video"]).optional(),
        whoCanMintLinks: z
          .array(z.enum(["owner", "admin", "editor"]))
          .optional(),
        monthlyCostCapUsd: z.number().int().min(0).nullable().optional(),
        defaultLanguage: z
          .enum(["en", "es", "fr", "de", "it", "pt", "nl", "ja", "ko", "zh"])
          .optional(),
        retention: z
          .object({
            audioDays: z.number().int().min(1).optional(),
            transcriptDays: z.number().int().min(1).optional(),
          })
          .optional(),
      })
      .optional(),
    publishing: z
      .object({
        defaultStatus: z.enum(["draft", "published"]).optional(),
        autoSchedule: z.boolean().optional(),
      })
      .optional(),
    images: z
      .object({
        unsplash: z.object({ apiKey: z.string().optional() }).optional(),
        pexels: z.object({ apiKey: z.string().optional() }).optional(),
      })
      .optional(),
  })
  .strict();

/**
 * GET /api/v1/config
 * Read the knowledge base config settings
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const config = await getBlogConfig(blogId);
    return NextResponse.json({ data: config });
  },
});

/**
 * PATCH /api/v1/config
 * Update blog config (partial merge)
 */
export const PATCH = createApiHandler({
  auth: "admin",
  input: updateBlogConfigSchema,
  audit: "update_blog_config",
  handler: async ({ body, blogId }) => {
    const payload = body as Record<string, unknown>;
    const updateData = flattenBlogConfigPayload(payload);

    // Read existing stored overrides (raw, before defaults are applied).
    const existingStored = await getStoredBlogConfig(blogId);

    // Apply the flat-key updates on top of the existing stored overrides.
    // applyFlatUpdates replicates Firestore's dot-path .update() semantics.
    const newStored = applyFlatUpdates(
      existingStored as Record<string, unknown>,
      updateData,
    ) as Partial<BlogConfig>;

    // Resolve the full merged config for validation.
    const resolvedConfig = resolveBlogConfig(newStored);

    const validationError = getResolvedTopBannerValidationError(
      resolvedConfig.publicAppearance?.topBanner,
    );
    if (validationError) {
      return NextResponse.json(
        {
          error: validationError.message,
          details: [
            {
              field: validationError.field,
              message: validationError.message,
            },
          ],
        },
        { status: 400 },
      );
    }

    await updateBlogConfig(blogId, newStored);

    return NextResponse.json({ data: resolvedConfig, updated: true });
  },
});
