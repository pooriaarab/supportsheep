import { resolvePublicSiteUrl } from "@/lib/public-site";

export const siteConfig = {
  name: "Supportsheep",
  shortName: "SB",
  description:
    "Practical guides on building and ranking a small business website with Supportsheep's AI-powered tools.",
  url: resolvePublicSiteUrl(),
  ogImage: "/og.png",
  creator: "Supportsheep",
  publisher: "Supportsheep",
  keywords: [
    "small business website",
    "seo for customers",
    "website builder",
    "supportsheep",
    "ai website",
  ],
} as const;
