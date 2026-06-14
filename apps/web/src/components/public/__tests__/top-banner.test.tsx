import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicTopBanner } from "@/components/public/top-banner";
import type { PublicTopBannerConfig } from "@repo/types";

const baseBanner: PublicTopBannerConfig = {
  enabled: true,
  message: "This content is AI-assisted and reviewed by humans",
  backgroundColor: "#FFF4D6",
  textColor: "#5F370E",
  scope: "homepage",
};

describe("PublicTopBanner", () => {
  it("renders nothing when disabled", () => {
    const html = renderToStaticMarkup(
      <PublicTopBanner
        topBanner={{ ...baseBanner, enabled: false }}
        isHomepage={true}
      />,
    );

    expect(html).toBe("");
  });

  it("renders only on the homepage when scope is homepage", () => {
    const onHomepage = renderToStaticMarkup(
      <PublicTopBanner topBanner={baseBanner} isHomepage={true} />,
    );
    const onArticlePage = renderToStaticMarkup(
      <PublicTopBanner topBanner={baseBanner} isHomepage={false} />,
    );

    expect(onHomepage).toContain(baseBanner.message);
    expect(onArticlePage).toBe("");
  });

  it("renders on non-homepage routes when scope is all", () => {
    const html = renderToStaticMarkup(
      <PublicTopBanner
        topBanner={{ ...baseBanner, scope: "all" }}
        isHomepage={false}
      />,
    );

    expect(html).toContain(baseBanner.message);
  });

  it("applies configured background and text colors", () => {
    const html = renderToStaticMarkup(
      <PublicTopBanner
        topBanner={{
          ...baseBanner,
          backgroundColor: "#111111",
          textColor: "#F9F9F9",
        }}
        isHomepage={true}
      />,
    );

    expect(html).toContain("background-color:#111111");
    expect(html).toContain("color:#F9F9F9");
  });

  it("renders plain text only", () => {
    const html = renderToStaticMarkup(
      <PublicTopBanner
        topBanner={{
          ...baseBanner,
          message: "<strong>Important:</strong> AI-assisted content",
        }}
        isHomepage={true}
      />,
    );

    expect(html).not.toContain("<strong>");
    expect(html).toContain("&lt;strong&gt;Important:&lt;/strong&gt;");
  });
});
