import type { Competitor } from "@repo/types";
export { stringifyJsonLdForScript } from "@/lib/public-site";

export function buildSoftwareApplicationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Supportsheep",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://supportsheep.com",
    publisher: {
      "@type": "Organization",
      name: "Supportsheep",
      url: "https://supportsheep.com",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    image: `${siteUrl}/favicon.png`,
  };
}

export function buildCompetitorProductJsonLd(competitor: Competitor) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: competitor.name,
    url: competitor.websiteUrl,
    description: competitor.bestFor,
    brand: {
      "@type": "Brand",
      name: competitor.name,
    },
  };
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

export function buildAlternativesItemListJsonLd(
  siteUrl: string,
  competitors: Competitor[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: competitors.map((competitor, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `Supportsheep vs ${competitor.name}`,
      url: `${siteUrl}/vs/${competitor.slug}`,
    })),
  };
}
