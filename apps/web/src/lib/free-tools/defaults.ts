import type { FreeToolAppearanceConfig } from "@repo/types";
import {
  buildDefaultFreeToolCallout,
  DEFAULT_BLOG_FREE_TOOLS_CONFIG,
  DEFAULT_FREE_TOOL_CTA,
} from "./config-defaults";
import type { DefaultFreeToolOptions, SeededFreeTool } from "./types";
import { FREE_TOOL_TEMPLATES } from "./templates";

const DEFAULT_BLOG_ID = "default" as const;

function defaultAppearance(category: string): FreeToolAppearanceConfig {
  if (
    category === "writing" ||
    category === "business" ||
    category === "aeo_geo"
  ) {
    return { layout: "editorial", accent: "blue" };
  }
  if (category === "schema") {
    return { layout: "compact", accent: "green" };
  }
  return { layout: "utility", accent: "default" };
}

function defaultFaq(title: string) {
  return [
    {
      question: `What does the ${title} do?`,
      answer: `The ${title} helps you complete a common SEO or content task directly in your browser.`,
    },
    {
      question: "Is this tool free to use?",
      answer:
        "Yes. The default seeded version is built as a free public tool with safe usage limits.",
    },
  ];
}

export function buildDefaultFreeTools(
  options: DefaultFreeToolOptions,
): SeededFreeTool[] {
  const now = options.now ?? new Date().toISOString();
  const blogId = options.blogId ?? DEFAULT_BLOG_ID;
  const defaultCallout = buildDefaultFreeToolCallout();

  return Object.values(FREE_TOOL_TEMPLATES).map((template) => ({
    id: template.slug,
    blogId,
    templateId: template.id,
    source: "predefined",
    enabled: options.enabled,
    slug: template.slug,
    title: template.title,
    metaTitle: template.seo.metaTitle,
    metaDescription: template.seo.metaDescription,
    intro: `${template.title}: ${template.description}`,
    faq: defaultFaq(template.title),
    cta: { ...DEFAULT_FREE_TOOL_CTA },
    callout: {
      ...defaultCallout,
      utm: { ...defaultCallout.utm },
    },
    appearance: defaultAppearance(template.category),
    ai: {
      enabled: template.executionMode === "ai" ? options.aiEnabled : false,
      provider: "claude",
      model: "",
      dailyLimit: DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultAiDailyLimit,
      maxInputChars: template.executionMode === "ai" ? 8000 : 12000,
      maxOutputTokens: template.executionMode === "ai" ? 2000 : 1200,
    },
    seo: {
      indexable: true,
      canonicalPath: `/tools/${template.slug}`,
      includeInToolsIndex: true,
      includeInSitemap: true,
    },
    createdAt: now,
    updatedAt: now,
  }));
}
