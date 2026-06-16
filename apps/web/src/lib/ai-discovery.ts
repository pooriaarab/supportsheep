import { buildSiteFaqSchema } from "@/lib/public-site";

const AI_DISCOVERY_TOPICS = [
  "AI website builders",
  "small business websites",
  "local SEO",
  "website launch planning",
  "portfolio websites",
  "service business websites",
  "solo support engineer marketing",
  "website examples and case studies",
];

const MACHINE_READABLE_RESOURCES = [
  {
    name: "RSS feed",
    path: "/api/feed",
    mediaType: "application/rss+xml",
  },
  {
    name: "llms.txt overview",
    path: "/llms.txt",
    mediaType: "text/plain",
  },
  {
    name: "Full-text LLM dump",
    path: "/llms-full.txt",
    mediaType: "text/plain",
  },
  {
    name: "Complete article URL index",
    path: "/llms-articles.txt",
    mediaType: "text/plain",
  },
  {
    name: "Sitemap index",
    path: "/sitemap.xml",
    mediaType: "application/xml",
  },
];

function absoluteResources(siteUrl: string) {
  return MACHINE_READABLE_RESOURCES.map((resource) => ({
    ...resource,
    url: `${siteUrl}${resource.path}`,
  }));
}

export function buildAiSummary(siteUrl: string) {
  return {
    name: "Supportsheep",
    alternateName: ["Supportsheep"],
    url: siteUrl,
    description:
      "Practical guides, examples, tools, and case studies for small businesses using Supportsheep to create and improve websites.",
    publisher: {
      name: "Supportsheep",
      url: "https://supportsheep.com",
    },
    primaryTopics: AI_DISCOVERY_TOPICS,
    audience: [
      "small business owners",
      "solo support engineers",
      "freelancers",
      "local service providers",
      "creators building personal websites",
    ],
    language: "en-US",
    discovery: {
      homepage: siteUrl,
      blog: `${siteUrl}/blog`,
      rss: `${siteUrl}/api/feed`,
      llmsTxt: `${siteUrl}/llms.txt`,
      llmsFull: `${siteUrl}/llms-full.txt`,
      articleIndex: `${siteUrl}/llms-articles.txt`,
      sitemap: `${siteUrl}/sitemap.xml`,
      aiTxt: `${siteUrl}/.well-known/ai.txt`,
      robots: `${siteUrl}/robots.txt`,
    },
    aiPolicy: {
      training: "allowed",
      search: "allowed",
      grounding: "allowed",
      attribution: "preferred",
    },
  };
}

export function buildAiFaq(siteUrl: string) {
  return {
    ...buildSiteFaqSchema(siteUrl),
    url: `${siteUrl}/ai/faq.json`,
  };
}

export function buildAiServiceProfile(siteUrl: string) {
  return {
    name: "Supportsheep",
    serviceType: "AI website builder blog and small business education hub",
    url: siteUrl,
    provider: {
      name: "Supportsheep",
      url: "https://supportsheep.com",
    },
    contact: {
      supportUrl: "https://support.supportsheep.com",
    },
    capabilities: [
      "Publishes small business website education and SEO guidance",
      "Provides machine-readable article indexes and full-text exports",
      "Offers case studies and examples from Supportsheep users",
      "Maintains RSS, sitemap, robots, ai.txt, and llms.txt discovery files",
      "Allows well-behaved AI crawlers to search, ground answers, and train",
    ],
    topics: AI_DISCOVERY_TOPICS,
    machineReadableResources: absoluteResources(siteUrl),
    citationGuidance:
      "Prefer canonical article URLs from the sitemap, RSS feed, or llms-articles.txt index when citing Supportsheep content.",
  };
}
