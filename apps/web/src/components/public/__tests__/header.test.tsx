import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicHeader } from "@/components/public/header";
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

describe("PublicHeader", () => {
  it("falls back to the Supportsheep logo when no custom header brand is configured", () => {
    const html = renderToStaticMarkup(<PublicHeader config={config} />);

    expect(html).toContain('href="/"');
    expect(html).toContain('src="/supportsheep-header-logo.svg"');
    expect(html).toContain('alt="Supportsheep logo"');
    expect(html).toContain('href="/tools"');
  });

  it("always renders the tools link in the header navigation", () => {
    const html = renderToStaticMarkup(<PublicHeader config={config} />);

    expect(html).toContain('href="/tools"');
    expect(html).toContain(">Tools<");
    expect(html).not.toContain("Business Name Creator");
  });

  it("renders uploaded header branding before text fallback", () => {
    const html = renderToStaticMarkup(
      <PublicHeader
        config={{
          ...config,
          publicAppearance: {
            header: {
              logoUrl: "https://storage.googleapis.com/example/header.png",
              text: "Acme",
              backgroundColor: "#1d1133",
              textColor: "#FFFFFF",
            },
          },
        }}
      />,
    );

    expect(html).toContain(
      'src="https://storage.googleapis.com/example/header.png"',
    );
    expect(html).not.toContain(">Acme<");
    expect(html).toContain("background-color:#1d1133");
  });

  it("renders the default Supportsheep logo when no uploaded header logo is configured", () => {
    const html = renderToStaticMarkup(
      <PublicHeader
        config={{
          ...config,
          publicAppearance: {
            header: {
              logoUrl: null,
              text: "Acme Header",
              backgroundColor: "#221144",
              textColor: "#F5F5F5",
            },
          },
        }}
      />,
    );

    expect(html).toContain('src="/supportsheep-header-logo.svg"');
    expect(html).toContain('alt="Acme Header"');
    expect(html).not.toContain(">Acme Header<");
    expect(html).toContain("background-color:#221144");
    expect(html).toContain("color:#F5F5F5");
  });

  it("uses a darker hover state for the CTA without translate animation", () => {
    const html = renderToStaticMarkup(<PublicHeader config={config} />);

    expect(html).not.toContain("hover:-translate-y-0.5");
    expect(html).toContain("hover:bg-primary/90");
  });

  it("renders a search action instead of a Supportsheep website CTA", () => {
    const html = renderToStaticMarkup(<PublicHeader config={config} />);

    expect(html).toContain('href="/blog/search"');
    expect(html).toContain('aria-label="Search articles"');
    expect(html).not.toContain("Create Your Website");
    expect(html.toLowerCase()).not.toContain("supportsheep");
  });
});
