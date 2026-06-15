import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicFooter } from "@/components/public/footer";
import type { BlogConfig } from "@repo/types";

const config: BlogConfig = {
  blogId: "default",
  siteName: "Supportsheep",
  siteDescription: "The Supportsheep demo blog.",
  logo: "",
  homepage: {
    layout: "grid",
    postsPerPage: 12,
    featuredCategory: null,
  },
  seo: {
    defaultMetaTitle: "Supportsheep",
    defaultMetaDescription: "The Supportsheep demo blog.",
    googleAnalyticsId: "",
    clarityId: "",
  },
  ai: {
    defaultProvider: "gpt",
    providers: {
      claude: { apiKey: "", model: "" },
      gpt: { apiKey: "", model: "" },
      gemini: { apiKey: "", model: "" },
    },
    defaultContextTagId: "",
    defaultSkillsPipeline: [],
  },
  publishing: {
    defaultStatus: "draft",
    autoSchedule: false,
  },
};

describe("PublicFooter", () => {
  it("renders a public tools link only when enabled public tools exist", () => {
    const withoutTools = renderToStaticMarkup(<PublicFooter config={config} />);
    const withTools = renderToStaticMarkup(
      <PublicFooter config={config} showToolsLink />,
    );

    expect(withoutTools).not.toContain('href="/tools"');
    expect(withTools).toContain('href="/tools"');
    expect(withTools).toContain(">Tools<");
  });

  it("falls back to the Supportsheep footer logo when no custom footer brand is configured", () => {
    const html = renderToStaticMarkup(<PublicFooter config={config} />);

    expect(html).toContain('src="/supportsheep-footer-logo.svg"');
    expect(html).toContain('alt="Supportsheep logo"');
  });

  it("renders a minimal blog footer with RSS and a Powered by Supportsheep credit", () => {
    const html = renderToStaticMarkup(<PublicFooter config={config} />);

    expect(html).toContain('href="/api/feed"');
    expect(html).toContain("Powered by Supportsheep");
    expect(html).toContain('href="https://supportsheep.com"');
  });

  it("does not render any stale Supportsheep tool or create-a-website columns", () => {
    const html = renderToStaticMarkup(<PublicFooter config={config} />);

    expect(html.toLowerCase()).toContain("supportsheep");
    expect(html).not.toContain("Business Name Creator");
    expect(html).not.toContain("Create a website");
    expect(html).not.toContain("Create a site from");
  });

  it("renders uploaded footer branding before text fallback", () => {
    const html = renderToStaticMarkup(
      <PublicFooter
        config={{
          ...config,
          publicAppearance: {
            footer: {
              logoUrl: "https://storage.googleapis.com/example/footer.png",
              text: "Acme Footer",
              backgroundColor: "#171325",
              textColor: "#FAFAFA",
            },
          },
        }}
      />,
    );

    expect(html).toContain(
      'src="https://storage.googleapis.com/example/footer.png"',
    );
    expect(html).not.toContain(">Acme Footer<");
    expect(html).toContain("background-color:#171325");
  });

  it("renders the default Supportsheep logo when no uploaded footer logo is configured", () => {
    const html = renderToStaticMarkup(
      <PublicFooter
        config={{
          ...config,
          publicAppearance: {
            footer: {
              logoUrl: null,
              text: "Acme Footer",
              backgroundColor: "#101820",
              textColor: "#EDEDED",
            },
          },
        }}
      />,
    );

    expect(html).toContain('src="/supportsheep-footer-logo.svg"');
    expect(html).toContain('alt="Acme Footer"');
    expect(html).not.toContain(">Acme Footer<");
    expect(html).toContain("background-color:#101820");
    expect(html).toContain("color:#EDEDED");
  });
});
