export interface EditorialCategorySeed {
  slug: string;
  displayName: string;
  description: string;
}

export interface EditorialPostSpec {
  title: string;
  slug: string;
  category: string;
  postType: "blog_post" | "how_to" | "comparison" | "pillar_page";
  cluster:
    | "vertical-seo"
    | "migration"
    | "local-seo"
    | "buyer-intent"
    | "technical-seo";
  authorId: "pooria-arab" | "madison-carter";
}

export const EDITORIAL_CATEGORY_SEEDS: readonly EditorialCategorySeed[] = [
  {
    slug: "seo",
    displayName: "SEO",
    description:
      "SEO playbooks for solopreneurs and local service businesses: technical fixes, local rankings, Google Business Profile, and content strategy.",
  },
  {
    slug: "guides",
    displayName: "Guides",
    description:
      "Step-by-step playbooks for launching and improving a small business website, from migrations to content systems and publishing workflows.",
  },
  {
    slug: "website-tips",
    displayName: "Website Tips",
    description:
      "Design, UX, structure, and platform advice to help small business websites load faster, convert better, and stay easy to manage.",
  },
  {
    slug: "niches",
    displayName: "Niches",
    description:
      "Industry-specific website and SEO advice for local service businesses, freelancers, consultants, and supportsheep operators.",
  },
  {
    slug: "marketing-tips",
    displayName: "Marketing Tips",
    description:
      "Low-budget growth tactics for solopreneurs, including local marketing, review generation, landing pages, and organic acquisition.",
  },
  {
    slug: "business-tips",
    displayName: "Business Tips",
    description:
      "Practical operating advice for supportsheep businesses: positioning, pricing, switching tools, and building a website that supports sales.",
  },
];

export const BLOG_EDITORIAL_BATCH: readonly EditorialPostSpec[] = [
  {
    title: "SEO for Plumbers: How to Get More Local Leads",
    slug: "seo-for-plumbers-local-leads",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Therapists in Private Practice",
    slug: "seo-for-therapists-private-practice",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Electricians: A Local Search Playbook",
    slug: "seo-for-electricians-local-search",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Cleaning Businesses That Need More Calls",
    slug: "seo-for-cleaning-businesses-calls",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Dentists: What Actually Moves Rankings",
    slug: "seo-for-dentists-local-rankings",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Small Law Firms: A Practical Guide",
    slug: "seo-for-small-law-firms",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Photographers Who Need Local Inquiries",
    slug: "seo-for-photographers-local-inquiries",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Coaches and Consultants",
    slug: "seo-for-coaches-and-consultants",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Roofers: How to Win More Nearby Jobs",
    slug: "seo-for-roofers-nearby-jobs",
    category: "seo",
    postType: "how_to",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "SEO for Home Service Businesses: The Core Local Stack",
    slug: "seo-for-home-service-businesses",
    category: "seo",
    postType: "pillar_page",
    cluster: "vertical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "How to Switch From Wix to Supportsheep Without Losing SEO",
    slug: "switch-from-wix-to-blogbat-without-losing-seo",
    category: "guides",
    postType: "how_to",
    cluster: "migration",
    authorId: "pooria-arab",
  },
  {
    title: "How to Move From Squarespace to Supportsheep Without Losing Rankings",
    slug: "move-from-squarespace-to-blogbat-without-losing-rankings",
    category: "guides",
    postType: "how_to",
    cluster: "migration",
    authorId: "pooria-arab",
  },
  {
    title: "WordPress to Supportsheep Migration Checklist",
    slug: "wordpress-to-blogbat-migration-checklist",
    category: "guides",
    postType: "how_to",
    cluster: "migration",
    authorId: "pooria-arab",
  },
  {
    title: "Website Builder Migration SEO Checklist",
    slug: "website-builder-migration-seo-checklist",
    category: "guides",
    postType: "how_to",
    cluster: "migration",
    authorId: "pooria-arab",
  },
  {
    title: "How to Redesign Your Website Without Losing Rankings",
    slug: "redesign-website-without-losing-rankings",
    category: "website-tips",
    postType: "how_to",
    cluster: "migration",
    authorId: "pooria-arab",
  },
  {
    title: "Google Business Profile for Plumbers",
    slug: "google-business-profile-for-plumbers",
    category: "seo",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "pooria-arab",
  },
  {
    title: "Google Business Profile for Therapists",
    slug: "google-business-profile-for-therapists",
    category: "seo",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "pooria-arab",
  },
  {
    title: "Google Business Profile for Electricians",
    slug: "google-business-profile-for-electricians",
    category: "seo",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "pooria-arab",
  },
  {
    title: "How to Build Service Area Pages That Rank",
    slug: "how-to-build-service-area-pages-that-rank",
    category: "seo",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "pooria-arab",
  },
  {
    title: "Local Landing Pages for Multiple Cities: What Works",
    slug: "local-landing-pages-for-multiple-cities",
    category: "seo",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "pooria-arab",
  },
  {
    title: "How to Get More Google Reviews for a Service Business",
    slug: "how-to-get-more-google-reviews-service-business",
    category: "marketing-tips",
    postType: "how_to",
    cluster: "local-seo",
    authorId: "madison-carter",
  },
  {
    title: "Best Website Builder for Therapists",
    slug: "best-website-builder-for-therapists",
    category: "website-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
  {
    title: "Best Website Builder for Photographers",
    slug: "best-website-builder-for-photographers",
    category: "website-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
  {
    title: "Best Website Builder for Dentists",
    slug: "best-website-builder-for-dentists",
    category: "website-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
  {
    title: "Best Website Builder for Lawyers",
    slug: "best-website-builder-for-lawyers",
    category: "website-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
  {
    title: "Best Website Builder for Coaches",
    slug: "best-website-builder-for-coaches",
    category: "website-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
  {
    title: "How to Fix Discovered - Currently Not Indexed",
    slug: "how-to-fix-discovered-currently-not-indexed",
    category: "seo",
    postType: "how_to",
    cluster: "technical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "How to Fix Crawled - Currently Not Indexed",
    slug: "how-to-fix-crawled-currently-not-indexed",
    category: "seo",
    postType: "how_to",
    cluster: "technical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "Website Migration Redirect Checklist",
    slug: "website-migration-redirect-checklist",
    category: "guides",
    postType: "how_to",
    cluster: "technical-seo",
    authorId: "pooria-arab",
  },
  {
    title: "Website Builder Pricing Comparison for 2026",
    slug: "website-builder-pricing-comparison-2026",
    category: "business-tips",
    postType: "comparison",
    cluster: "buyer-intent",
    authorId: "madison-carter",
  },
] as const;

const DAILY_POSTS = [3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] as const;
const DAILY_HOURS = [15, 19, 23] as const;

export function buildEditorialSchedule(startDate: string, index: number) {
  if (index < 0 || index >= BLOG_EDITORIAL_BATCH.length) {
    throw new RangeError(`Editorial schedule index out of range: ${index}`);
  }

  const publishAt = new Date(startDate);
  publishAt.setUTCHours(0, 0, 0, 0);

  let remaining = index;
  let dayIndex = 0;
  while (remaining >= DAILY_POSTS[dayIndex]!) {
    remaining -= DAILY_POSTS[dayIndex]!;
    dayIndex += 1;
  }

  publishAt.setUTCDate(publishAt.getUTCDate() + dayIndex);
  publishAt.setUTCHours(DAILY_HOURS[remaining]!, 0, 0, 0);
  return publishAt.toISOString();
}
