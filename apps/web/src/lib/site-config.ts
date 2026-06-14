import { resolvePublicSiteUrl } from "@/lib/public-site";

export const siteConfig = {
  name: "BlogBat",
  shortName: "SB",
  description:
    "Practical guides on building and ranking a small business website with BlogBat's AI-powered tools.",
  url: resolvePublicSiteUrl(),
  ogImage: "/og.png",
  creator: "BlogBat",
  publisher: "BlogBat",
  keywords: [
    "small business website",
    "seo for solopreneurs",
    "website builder",
    "blogbat",
    "ai website",
  ],
} as const;
