import type {
  BlogFreeToolsConfig,
  FreeToolCalloutConfig,
  FreeToolCtaConfig,
} from "@repo/types";

export const DEFAULT_FREE_TOOL_CTA: FreeToolCtaConfig = {
  label: "Try Supportsheep",
  url: "https://supportsheep.com/",
};

export const DEFAULT_BLOG_FREE_TOOLS_CONFIG: BlogFreeToolsConfig = {
  indexEnabled: false,
  defaultCta: DEFAULT_FREE_TOOL_CTA,
  defaultCallout: {
    enabled: true,
    heading: "Build your website with Supportsheep",
    body: "Turn this free tool result into a website, blog post, or landing page with Supportsheep.",
    primaryLabel: "Try Supportsheep",
    primaryBaseUrl: "https://supportsheep.com/",
    secondaryLabel: "Learn more",
    secondaryBaseUrl: "https://supportsheep.com/",
    utmSource: "supportsheep_blog",
    utmMedium: "free_tool",
    utmCampaign: "{{toolSlug}}",
    utmContent: "bottom_callout",
    utmTerm: "",
  },
  defaultAiDailyLimit: 10,
  defaultNonAiMinuteLimit: 60,
};

export function buildDefaultFreeToolCallout(): FreeToolCalloutConfig {
  const callout = DEFAULT_BLOG_FREE_TOOLS_CONFIG.defaultCallout;
  return {
    enabled: callout.enabled,
    heading: callout.heading,
    body: callout.body,
    primaryLabel: callout.primaryLabel,
    primaryUrl: callout.primaryBaseUrl,
    secondaryLabel: callout.secondaryLabel,
    secondaryUrl: callout.secondaryBaseUrl,
    utm: {
      source: callout.utmSource,
      medium: callout.utmMedium,
      campaign: callout.utmCampaign,
      content: callout.utmContent,
      term: callout.utmTerm,
    },
  };
}
