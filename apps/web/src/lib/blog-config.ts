/**
 * Server-side blog config loader
 *
 * Reads / writes the knowledge base_config D1 table (per-blog singleton).
 * Used by public pages (homepage, article pages, RSS, sitemap).
 */

import "server-only";

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogConfig as blogConfigTable } from "@/db/schema/config";
import { DEFAULT_BLOG_FREE_TOOLS_CONFIG } from "@/lib/free-tools/config-defaults";
import { DEFAULT_PUBLIC_ARTICLE_APPEARANCE } from "@/lib/public-article-appearance";
import { normalizePublicBlogConfig } from "@/lib/public-content";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type {
  BlogConfig,
  BlogFreeToolsConfig,
  PermalinkSettings,
  InterviewLanguage,
} from "@repo/types";

type DB = DrizzleD1Database<typeof schema>;

const DEFAULT_PERMALINKS: PermalinkSettings = {
  canonicalPattern: "/<slug>/",
  redirectOldPatterns: true,
  allowedPatterns: [
    "/<slug>/",
    "/<category>/<slug>/",
    "/blog/<slug>/",
    "/blog/<category>/<slug>/",
  ],
};

const DEFAULT_TOP_BANNER = {
  enabled: false,
  message: "This content is AI-assisted and reviewed by humans where applicable",
  backgroundColor: "#FFF4D6",
  textColor: "#5F370E",
  scope: "homepage" as const,
} as const;

const DEFAULT_PUBLIC_HEADER = {
  logoUrl: null,
  text: "",
  backgroundColor: "#1d1133",
  textColor: "#FFFFFF",
} as const;

const DEFAULT_PUBLIC_FOOTER = {
  logoUrl: null,
  text: "",
  backgroundColor: "#171325",
  textColor: "#FFFFFF",
} as const;

const DEFAULT_PUBLIC_APPEARANCE = {
  themeMode: "light" as const,
  topBanner: DEFAULT_TOP_BANNER,
  header: DEFAULT_PUBLIC_HEADER,
  footer: DEFAULT_PUBLIC_FOOTER,
  article: DEFAULT_PUBLIC_ARTICLE_APPEARANCE,
};

const DEFAULT_INDEXNOW_CONFIG = {
  enabled: false,
  apiKey: "",
};

const DEFAULT_INTERVIEW_CONFIG = {
  defaultStyle: "smart" as const,
  defaultDurationSec: 300,
  defaultRecording: "transcript" as const,
  whoCanMintLinks: ["owner", "admin", "editor"] as ("owner" | "admin" | "editor")[],
  monthlyCostCapUsd: null as number | null,
  retention: {
    audioDays: 90,
    transcriptDays: 365,
  },
  defaultLanguage: "en" as InterviewLanguage,
};

export const DEFAULT_BLOG_CONFIG: BlogConfig = {
  blogId: "default",
  siteName: "Support Portal",
  siteDescription: "A modern knowledge base",
  logo: "",
  permalinks: DEFAULT_PERMALINKS,
  publicAppearance: DEFAULT_PUBLIC_APPEARANCE,
  homepage: {
    layout: "grid",
    postsPerPage: 12,
    featuredCategory: null,
  },
  seo: {
    defaultMetaTitle: "Support Portal",
    defaultMetaDescription: "A modern knowledge base",
    googleAnalyticsId: "",
    clarityId: "",
    submissionProtocols: {
      indexNow: DEFAULT_INDEXNOW_CONFIG,
    },
  },
  ai: {
    defaultProvider: "claude",
    providers: {
      claude: { apiKey: "", model: "claude-sonnet-4-6" },
      gpt: { apiKey: "", model: "gpt-5.4-mini" },
      gemini: { apiKey: "", model: "gemini-2.0-flash" },
      tavus: { apiKey: "", defaultAvatarId: "", defaultPersonaId: "" },
    },
    defaultContextTagId: "",
    defaultSkillsPipeline: [],
  },
  analytics: {
    gaMeasurementId: "",
  },
  freeTools: DEFAULT_BLOG_FREE_TOOLS_CONFIG,
  interview: DEFAULT_INTERVIEW_CONFIG,
  publishing: {
    defaultStatus: "draft",
    autoSchedule: false,
  },
  support: {
    enableVoice: false,
    enableChatbot: false,
    systemPrompt: "You are a helpful support assistant. Use the provided knowledge base to answer questions.",
    greeting: "Hi there! How can I help you today?",
  },
};

export function mergeBlogConfig(
  config?: Partial<BlogConfig> | null,
): BlogConfig {
  const permalinks = {
    ...DEFAULT_PERMALINKS,
    ...config?.permalinks,
  };
  const incomingTopBanner = config?.publicAppearance?.topBanner;
  const incomingHeader = config?.publicAppearance?.header;
  const incomingFooter = config?.publicAppearance?.footer;
  const incomingArticle = config?.publicAppearance?.article;
  const topBanner = {
    enabled: incomingTopBanner?.enabled ?? DEFAULT_TOP_BANNER.enabled,
    message: incomingTopBanner?.message ?? DEFAULT_TOP_BANNER.message,
    backgroundColor:
      incomingTopBanner?.backgroundColor ?? DEFAULT_TOP_BANNER.backgroundColor,
    textColor: incomingTopBanner?.textColor ?? DEFAULT_TOP_BANNER.textColor,
    scope: incomingTopBanner?.scope ?? DEFAULT_TOP_BANNER.scope,
  };
  const header = {
    logoUrl: incomingHeader?.logoUrl ?? DEFAULT_PUBLIC_HEADER.logoUrl,
    text: incomingHeader?.text ?? DEFAULT_PUBLIC_HEADER.text,
    backgroundColor:
      incomingHeader?.backgroundColor ?? DEFAULT_PUBLIC_HEADER.backgroundColor,
    textColor: incomingHeader?.textColor ?? DEFAULT_PUBLIC_HEADER.textColor,
  };
  const footer = {
    logoUrl: incomingFooter?.logoUrl ?? DEFAULT_PUBLIC_FOOTER.logoUrl,
    text: incomingFooter?.text ?? DEFAULT_PUBLIC_FOOTER.text,
    backgroundColor:
      incomingFooter?.backgroundColor ?? DEFAULT_PUBLIC_FOOTER.backgroundColor,
    textColor: incomingFooter?.textColor ?? DEFAULT_PUBLIC_FOOTER.textColor,
  };
  const article = {
    cards: {
      borderRadiusPreset:
        incomingArticle?.cards?.borderRadiusPreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.cards.borderRadiusPreset,
      borderRadius:
        incomingArticle?.cards?.borderRadius ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.cards.borderRadius,
      shadowPreset:
        incomingArticle?.cards?.shadowPreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.cards.shadowPreset,
      hoverStyle:
        incomingArticle?.cards?.hoverStyle ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.cards.hoverStyle,
    },
    readingLayout: {
      contentWidthPreset:
        incomingArticle?.readingLayout?.contentWidthPreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout.contentWidthPreset,
      contentWidth:
        incomingArticle?.readingLayout?.contentWidth ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout.contentWidth,
      bodyLineHeightPreset:
        incomingArticle?.readingLayout?.bodyLineHeightPreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout.bodyLineHeightPreset,
      bodyLineHeight:
        incomingArticle?.readingLayout?.bodyLineHeight ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout.bodyLineHeight,
      summaryBoxStyle:
        incomingArticle?.readingLayout?.summaryBoxStyle ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout.summaryBoxStyle,
    },
    tableOfContents: {
      enabled:
        incomingArticle?.tableOfContents?.enabled ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.tableOfContents.enabled,
      stylePreset:
        incomingArticle?.tableOfContents?.stylePreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.tableOfContents.stylePreset,
    },
    typography: {
      fontPreset:
        incomingArticle?.typography?.fontPreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.typography.fontPreset,
      headingScalePreset:
        incomingArticle?.typography?.headingScalePreset ??
        DEFAULT_PUBLIC_ARTICLE_APPEARANCE.typography.headingScalePreset,
    },
  };

  const publicAppearance = {
    ...DEFAULT_PUBLIC_APPEARANCE,
    ...config?.publicAppearance,
    topBanner,
    header,
    footer,
    article,
  };
  const indexNow = {
    ...DEFAULT_INDEXNOW_CONFIG,
    ...config?.seo?.submissionProtocols?.indexNow,
  };
  const freeTools: BlogFreeToolsConfig = {
    indexEnabled:
      config?.freeTools?.indexEnabled ??
      DEFAULT_BLOG_FREE_TOOLS_CONFIG.indexEnabled,
    defaultCta: {
      ...DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultCta,
      ...config?.freeTools?.defaultCta,
    },
    defaultCallout: {
      ...DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultCallout,
      ...config?.freeTools?.defaultCallout,
    },
    defaultAiDailyLimit:
      config?.freeTools?.defaultAiDailyLimit ??
      DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultAiDailyLimit,
    defaultNonAiMinuteLimit:
      config?.freeTools?.defaultNonAiMinuteLimit ??
      DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultNonAiMinuteLimit,
  };

  const interview = {
    defaultStyle:
      config?.interview?.defaultStyle ??
      DEFAULT_INTERVIEW_CONFIG.defaultStyle,
    defaultDurationSec:
      config?.interview?.defaultDurationSec ??
      DEFAULT_INTERVIEW_CONFIG.defaultDurationSec,
    defaultRecording:
      config?.interview?.defaultRecording ??
      DEFAULT_INTERVIEW_CONFIG.defaultRecording,
    whoCanMintLinks:
      config?.interview?.whoCanMintLinks ??
      DEFAULT_INTERVIEW_CONFIG.whoCanMintLinks,
    monthlyCostCapUsd:
      config?.interview?.monthlyCostCapUsd !== undefined
        ? config.interview.monthlyCostCapUsd
        : DEFAULT_INTERVIEW_CONFIG.monthlyCostCapUsd,
    defaultLanguage:
      config?.interview?.defaultLanguage ??
      DEFAULT_INTERVIEW_CONFIG.defaultLanguage,
    retention: {
      audioDays:
        config?.interview?.retention?.audioDays ??
        DEFAULT_INTERVIEW_CONFIG.retention.audioDays,
      transcriptDays:
        config?.interview?.retention?.transcriptDays ??
        DEFAULT_INTERVIEW_CONFIG.retention.transcriptDays,
    },
  };

  const merged = {
    ...DEFAULT_BLOG_CONFIG,
    ...config,
    permalinks: {
      canonicalPattern: permalinks.canonicalPattern ?? DEFAULT_PERMALINKS.canonicalPattern,
      redirectOldPatterns:
        permalinks.redirectOldPatterns ?? DEFAULT_PERMALINKS.redirectOldPatterns,
      allowedPatterns: permalinks.allowedPatterns ?? DEFAULT_PERMALINKS.allowedPatterns,
    },
    publicAppearance: {
      themeMode: publicAppearance.themeMode ?? DEFAULT_PUBLIC_APPEARANCE.themeMode,
      topBanner: publicAppearance.topBanner,
      header: publicAppearance.header,
      footer: publicAppearance.footer,
      article: publicAppearance.article,
    },
    homepage: {
      ...DEFAULT_BLOG_CONFIG.homepage,
      ...config?.homepage,
    },
    seo: {
      ...DEFAULT_BLOG_CONFIG.seo,
      ...config?.seo,
      submissionProtocols: {
        ...DEFAULT_BLOG_CONFIG.seo.submissionProtocols,
        ...config?.seo?.submissionProtocols,
        indexNow,
      },
    },
    ai: {
      ...DEFAULT_BLOG_CONFIG.ai,
      ...config?.ai,
      providers: {
        ...DEFAULT_BLOG_CONFIG.ai.providers,
        ...config?.ai?.providers,
        claude: {
          ...DEFAULT_BLOG_CONFIG.ai.providers.claude,
          ...config?.ai?.providers?.claude,
        },
        gpt: {
          ...DEFAULT_BLOG_CONFIG.ai.providers.gpt,
          ...config?.ai?.providers?.gpt,
        },
        gemini: {
          ...DEFAULT_BLOG_CONFIG.ai.providers.gemini,
          ...config?.ai?.providers?.gemini,
        },
        tavus: {
          apiKey: config?.ai?.providers?.tavus?.apiKey ?? "",
          defaultAvatarId: config?.ai?.providers?.tavus?.defaultAvatarId ?? "",
          defaultPersonaId:
            config?.ai?.providers?.tavus?.defaultPersonaId ?? "",
        },
      },
    },
    analytics: {
      gaMeasurementId:
        config?.analytics?.gaMeasurementId ??
        DEFAULT_BLOG_CONFIG.analytics?.gaMeasurementId ??
        "",
    },
    freeTools,
    interview,
    publishing: {
      ...DEFAULT_BLOG_CONFIG.publishing,
      ...config?.publishing,
    },
    images: config?.images
      ? {
          ...config.images,
          unsplash: config.images.unsplash
            ? {
                apiKey: config.images.unsplash.apiKey ?? "",
              }
            : undefined,
          pexels: config.images.pexels
            ? {
                apiKey: config.images.pexels.apiKey ?? "",
              }
            : undefined,
        }
      : DEFAULT_BLOG_CONFIG.images,
    support: {
      enableVoice: config?.support?.enableVoice ?? DEFAULT_BLOG_CONFIG.support!.enableVoice,
      enableChatbot: config?.support?.enableChatbot ?? DEFAULT_BLOG_CONFIG.support!.enableChatbot,
      systemPrompt: config?.support?.systemPrompt ?? DEFAULT_BLOG_CONFIG.support!.systemPrompt,
      greeting: config?.support?.greeting ?? DEFAULT_BLOG_CONFIG.support!.greeting,
    },
  };

  return normalizePublicBlogConfig(merged);
}

/**
 * Fetch the knowledge base config from D1 with a default fallback.
 * Safe to call from server components and API routes.
 */
export async function getBlogConfig(blogId: string = DEFAULT_blog_id): Promise<BlogConfig> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(blogConfigTable)
      .where(eq(blogConfigTable.blogId, blogId))
      .limit(1);
    if (rows.length > 0) {
      return mergeBlogConfig(JSON.parse(rows[0].data) as Partial<BlogConfig>);
    }
    return DEFAULT_BLOG_CONFIG;
  } catch {
    return DEFAULT_BLOG_CONFIG;
  }
}

/**
 * Return the raw stored overrides for a blog (what was written to D1, before
 * defaults are applied). Returns {} if no row exists yet.
 */
export async function getStoredBlogConfig(
  blogId: string = DEFAULT_blog_id,
  db: DB = getDb(),
): Promise<Partial<BlogConfig>> {
  const rows = await db
    .select()
    .from(blogConfigTable)
    .where(eq(blogConfigTable.blogId, blogId))
    .limit(1);
  if (rows.length > 0) {
    return JSON.parse(rows[0].data) as Partial<BlogConfig>;
  }
  return {};
}

/**
 * UPSERT the stored overrides for a blog.
 */
export async function updateBlogConfig(
  blogId: string,
  stored: Partial<BlogConfig>,
  db: DB = getDb(),
): Promise<void> {
  await db
    .insert(blogConfigTable)
    .values({
      blogId,
      data: JSON.stringify(stored),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: blogConfigTable.blogId,
      set: {
        data: JSON.stringify(stored),
        updatedAt: Date.now(),
      },
    });
}

export function resolveBlogConfig(
  config?: Partial<BlogConfig> | null,
): BlogConfig {
  return mergeBlogConfig(config);
}
