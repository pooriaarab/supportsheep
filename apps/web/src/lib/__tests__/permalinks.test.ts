import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMALINK_SETTINGS,
  buildArticlePaths,
  getCategoryPath,
  getPermalinkSettings,
  isReservedRootSlug,
  normalizeCategorySegment,
} from "@/lib/permalinks";

describe("buildArticlePaths", () => {
  it("uses root-level canonical paths for the default permalink pattern", () => {
    const result = buildArticlePaths(
      {
        slug: "ideas-for-personal-websites",
        category: "uncategorized",
      },
      DEFAULT_PERMALINK_SETTINGS,
    );

    expect(result.canonicalPath).toBe("/ideas-for-personal-websites");
    expect(result.legacyPaths).toContain(
      "/blog/uncategorized/ideas-for-personal-websites",
    );
    expect(result.legacyPaths).toContain(
      "/uncategorized/ideas-for-personal-websites",
    );
  });

  it("blocks reserved root slugs from becoming canonical article paths", () => {
    expect(isReservedRootSlug("login")).toBe(true);
    expect(isReservedRootSlug("seo")).toBe(true);
    expect(isReservedRootSlug("dashboard")).toBe(true);
    expect(isReservedRootSlug("ideas-for-personal-websites")).toBe(false);
  });

  it("normalizes category display names for category urls", () => {
    expect(normalizeCategorySegment("Website Tips")).toBe("website-tips");
    expect(getCategoryPath("Uncategorized")).toBe("/category/uncategorized");
  });

  it("clamps unsupported canonical settings back to the root permalink", () => {
    expect(
      getPermalinkSettings({
        permalinks: {
          ...DEFAULT_PERMALINK_SETTINGS,
          canonicalPattern: "/blog/<slug>/",
        },
      }).canonicalPattern,
    ).toBe("/<slug>/");
  });
});
