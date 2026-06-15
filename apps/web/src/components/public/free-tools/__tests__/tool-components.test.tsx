import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolCallout } from "@/components/public/free-tools/tool-callout";
import { ToolIndex } from "@/components/public/free-tools/tool-index";
import { ResultView, ToolPage } from "@/components/public/free-tools/tool-page";
import { buildDefaultFreeTools } from "@/lib/free-tools/defaults";
import { getFreeToolTemplate } from "@/lib/free-tools/templates";

const wordCounter = buildDefaultFreeTools({
  enabled: true,
  aiEnabled: true,
}).find((tool) => tool.templateId === "word-counter");

if (!wordCounter) {
  throw new Error("Word counter default tool is missing");
}

const wordCounterTemplate = getFreeToolTemplate("word-counter");
const youtubeEngagement = buildDefaultFreeTools({
  enabled: true,
  aiEnabled: true,
}).find((tool) => tool.templateId === "youtube-engagement-calculator");
const youtubeEngagementTemplate = getFreeToolTemplate(
  "youtube-engagement-calculator",
);
const cacTool = buildDefaultFreeTools({
  enabled: true,
  aiEnabled: true,
}).find((tool) => tool.templateId === "cac-calculator");
const cacTemplate = getFreeToolTemplate("cac-calculator");
const tiktokCaptionTool = buildDefaultFreeTools({
  enabled: true,
  aiEnabled: true,
}).find((tool) => tool.templateId === "tiktok-caption-generator");

if (!wordCounterTemplate) {
  throw new Error("Word counter template is missing");
}
if (!youtubeEngagement || !youtubeEngagementTemplate) {
  throw new Error("YouTube engagement calculator default tool is missing");
}
if (!cacTool || !cacTemplate) {
  throw new Error("CAC calculator default tool is missing");
}
if (!tiktokCaptionTool) {
  throw new Error("TikTok caption generator default tool is missing");
}

describe("free tools public components", () => {
  it("renders the searchable tools index with enabled tool links", () => {
    const html = renderToStaticMarkup(
      <ToolIndex
        tools={[
          {
            id: wordCounter.id,
            slug: wordCounter.slug,
            title: wordCounter.title,
            metaDescription: wordCounter.metaDescription,
            templateId: wordCounter.templateId,
            category: "utility",
          },
        ]}
      />,
    );

    expect(html).toContain("Free Tools");
    expect(html).toContain("Search tools");
    expect(html).toContain('href="/tools/word-counter"');
  });

  it("renders a registered template form without exposing prompt fields", () => {
    const html = renderToStaticMarkup(
      <ToolPage
        tool={wordCounter}
        inputs={wordCounterTemplate.inputs}
        executionMode={wordCounterTemplate.executionMode}
      />,
    );

    expect(html).toContain("Word Counter");
    expect(html).toContain("Analyze text");
    expect(html).toContain("disabled");
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<details");
    expect(html).not.toContain("defaultPrompt");
    expect(html).not.toContain("raw prompt");
  });

  it("renders numeric tool fields with decimal input validation hints", () => {
    const html = renderToStaticMarkup(
      <ToolPage
        tool={youtubeEngagement}
        inputs={youtubeEngagementTemplate.inputs}
        executionMode={youtubeEngagementTemplate.executionMode}
      />,
    );

    expect(html).toContain('name="views"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('pattern="[0-9]*(?:\\.[0-9]+)?"');
  });

  it("renders calculator fields with visible units and helper copy", () => {
    const html = renderToStaticMarkup(
      <ToolPage
        tool={cacTool}
        inputs={cacTemplate.inputs}
        executionMode={cacTemplate.executionMode}
      />,
    );

    expect(html).toContain("Sales and marketing spend");
    expect(html).toContain("Unit: USD");
    expect(html).toContain("New customers");
    expect(html).toContain("Unit: customers");
  });

  it("renders the tool result panel below the form on desktop layouts", () => {
    const html = renderToStaticMarkup(
      <ToolPage
        tool={wordCounter}
        inputs={wordCounterTemplate.inputs}
        executionMode={wordCounterTemplate.executionMode}
      />,
    );

    expect(html).toContain('data-tool-workspace="stacked"');
    expect(html).toContain('data-tool-result-panel="true"');
    expect(html).not.toContain("lg:grid-cols");
  });

  it("renders barcode SVG results as a preview with copy and download actions", () => {
    const barcodeTool = buildDefaultFreeTools({
      enabled: true,
      aiEnabled: true,
    }).find((tool) => tool.templateId === "barcode-generator");

    if (!barcodeTool) {
      throw new Error("Barcode generator default tool is missing");
    }

    const html = renderToStaticMarkup(
      <ResultView
        tool={barcodeTool}
        result={{
          kind: "text",
          summary: "Generated SVG barcode-style asset",
          text: '<svg xmlns="http://www.w3.org/2000/svg" width="190" height="110" viewBox="0 0 190 110"><rect width="190" height="110" fill="white" /><rect x="10" y="10" width="3" height="72" /></svg>',
        }}
      />,
    );

    expect(html).toContain("Barcode preview");
    expect(html).toContain('data-barcode-preview="true"');
    expect(html).toContain('role="img"');
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Copy result"');
    expect(html).toContain('aria-label="Download result"');
    expect(html).not.toContain("&lt;svg");
  });

  it("renders markdown emphasis in social previews instead of raw markers", () => {
    const html = renderToStaticMarkup(
      <ResultView
        tool={tiktokCaptionTool}
        result={{
          kind: "text",
          summary: "Generated **TikTok** captions",
          text: [
            "Here are short TikTok caption options for **Solo Grow**:",
            "",
            "1. **Grow smarter with Solo Grow**",
            "2. **Your growth, solo made simple.**",
          ].join("\n"),
        }}
      />,
    );

    expect(html).toContain("<strong>TikTok</strong>");
    expect(html).toContain("<strong>Solo Grow</strong>");
    expect(html).toContain("<strong>Grow smarter with Solo Grow</strong>");
    expect(html).not.toContain("**Solo Grow**");
  });

  it("formats calculator metrics with business units", () => {
    const html = renderToStaticMarkup(
      <ResultView
        tool={cacTool}
        result={{
          kind: "stats",
          summary: "Customer acquisition cost: 25",
          metrics: {
            salesMarketingSpend: 1000,
            newCustomers: 40,
            cac: 25,
          },
        }}
      />,
    );

    expect(html).toContain("$1,000");
    expect(html).toContain("40 customers");
    expect(html).toContain("$25");
  });

  it("sanitizes barcode SVG markup before rendering", () => {
    const barcodeTool = buildDefaultFreeTools({
      enabled: true,
      aiEnabled: true,
    }).find((tool) => tool.templateId === "barcode-generator");

    if (!barcodeTool) {
      throw new Error("Barcode generator default tool is missing");
    }

    const html = renderToStaticMarkup(
      <ResultView
        tool={barcodeTool}
        result={{
          kind: "text",
          summary: "Generated SVG barcode-style asset",
          text: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>bad</div></foreignObject><rect width="10" height="10" onclick="alert(1)" /></svg>',
        }}
      />,
    );

    expect(html).toContain("<svg");
    expect(html).toContain("<rect");
    expect(html).not.toContain("onload");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("foreignObject");
  });

  it("strips animate and anchor elements that can inject javascript URLs", () => {
    const barcodeTool = buildDefaultFreeTools({
      enabled: true,
      aiEnabled: true,
    }).find((tool) => tool.templateId === "barcode-generator");

    if (!barcodeTool) {
      throw new Error("Barcode generator default tool is missing");
    }

    const html = renderToStaticMarkup(
      <ResultView
        tool={barcodeTool}
        result={{
          kind: "text",
          summary: "Generated SVG barcode-style asset",
          text: '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="100%" height="100%" fill="transparent"/><animate attributeName="href" to="javascript:alert(2)" begin="0s" fill="freeze"/></a><set attributeName="onload" to="alert(3)"/><rect width="10" height="10"/></svg>',
        }}
      />,
    );

    expect(html).toContain("<svg");
    expect(html).toContain("<rect");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<animate");
    expect(html).not.toContain("<set");
    expect(html).not.toContain("javascript:");
  });

  it("renders the bottom callout with tool-specific UTM parameters", () => {
    const html = renderToStaticMarkup(<ToolCallout tool={wordCounter} />);

    expect(html).toContain(wordCounter.callout.primaryLabel);
    expect(html).toContain("utm_source=blogbat_blog");
    expect(html).toContain("utm_campaign=word-counter");
  });
});
