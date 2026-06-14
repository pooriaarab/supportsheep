import { describe, expect, it } from "vitest";
import { buildApiCatalog } from "@/lib/api-catalog";

describe("api catalog", () => {
  it("builds linksets for the public machine-readable APIs", () => {
    const siteUrl = "https://blogbat.com";
    const catalog = buildApiCatalog(siteUrl);

    expect(catalog.linkset.map((entry) => entry.anchor)).toEqual(
      expect.arrayContaining([
        `${siteUrl}/api/v1/public/articles`,
        `${siteUrl}/api/v1/public/articles/{slug}`,
        `${siteUrl}/api/search`,
        `${siteUrl}/api/feed`,
        `${siteUrl}/api/markdown`,
      ]),
    );

    for (const entry of catalog.linkset) {
      expect(entry.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rel: "service-doc",
            href: `${siteUrl}/docs/api`,
          }),
        ]),
      );
    }
  });
});
