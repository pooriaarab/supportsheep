import { describe, expect, it } from "vitest";
import {
  buildAlternativesItemListJsonLd,
  buildCompetitorProductJsonLd,
  buildFaqPageJsonLd,
  buildSoftwareApplicationJsonLd,
  stringifyJsonLdForScript,
} from "@/lib/alternatives/json-ld";
import type { Competitor } from "@repo/types";

const competitor: Competitor = {
  id: "wix",
  name: "Wix",
  slug: "wix",
  websiteUrl: "https://www.wix.com",
  bestFor: "Drag-and-drop designers",
  pricingTiers: [
    { name: "Light", monthlyPrice: "$17/mo", summary: "Entry plan" },
  ],
  featureMatrixRow: [
    { feature: "Custom domain", supportsheep: "Yes", competitor: "Paid plans only" },
  ],
  prosCons: { pros: ["Pro"], cons: ["Con"] },
  verifiedAt: "2026-04-20",
};

describe("alternatives JSON-LD builders", () => {
  it("builds a SoftwareApplication entry for Supportsheep", () => {
    const json = buildSoftwareApplicationJsonLd("https://supportsheep.com");
    expect(json).toMatchObject({
      "@type": "SoftwareApplication",
      name: "Supportsheep",
      applicationCategory: "BusinessApplication",
    });
  });

  it("builds a Product entry for the competitor", () => {
    const json = buildCompetitorProductJsonLd(competitor);
    expect(json).toMatchObject({
      "@type": "Product",
      name: "Wix",
      url: "https://www.wix.com",
    });
  });

  it("builds an ItemList referencing every competitor", () => {
    const json = buildAlternativesItemListJsonLd("https://supportsheep.com", [
      competitor,
    ]);
    expect(json).toMatchObject({
      "@type": "ItemList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Supportsheep vs Wix",
          url: "https://supportsheep.com/vs/wix",
        },
      ],
    });
  });

  it("builds a FAQPage entry with Question/Answer pairs", () => {
    const json = buildFaqPageJsonLd([
      { question: "Is Supportsheep free?", answer: "Yes." },
    ]);
    expect(json).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is Supportsheep free?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    });
  });

  it("escapes the less-than character so the payload cannot break out of a script tag", () => {
    const serialized = stringifyJsonLdForScript({
      text: "</script><script>alert(1)</script>",
    });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script");
  });
});
