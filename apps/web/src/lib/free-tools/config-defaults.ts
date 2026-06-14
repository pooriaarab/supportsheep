import type {
  BlogFreeToolsConfig,
  FreeToolCalloutConfig,
  FreeToolCtaConfig,
} from "@repo/types";

export const DEFAULT_FREE_TOOL_CTA: FreeToolCtaConfig = {
  label: "Try BlogBat",
  url: "https://blogbat.com/",
};

export const DEFAULT_BLOG_FREE_TOOLS_CONFIG: BlogFreeToolsConfig = {
  indexEnabled: false,
  defaultCta: DEFAULT_FREE_TOOL_CTA,
  defaultCallout: {
    enabled: true,
    heading: "Build your website with BlogBat",
    body: "Turn this free tool result into a website, blog post, or landing page with BlogBat.",
    primaryLabel: "Try BlogBat",
    primaryBaseUrl: "https://blogbat.com/",
    secondaryLabel: "Learn more",
    secondaryBaseUrl: "https://blogbat.com/",
    utmSource: "blogbat_blog",
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
