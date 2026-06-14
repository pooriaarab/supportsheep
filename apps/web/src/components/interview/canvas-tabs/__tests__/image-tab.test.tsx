import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageTab } from "../image-tab";
import type { CanvasState } from "@/hooks/use-interview-session";

const emptyCanvas: CanvasState = {
  title: null,
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
};

const titledCanvas: CanvasState = {
  title: "How To Ship Faster",
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
};

describe("ImageTab", () => {
  it("shows the empty placeholder when canvas has no title and no featured image", () => {
    const html = renderToStaticMarkup(<ImageTab canvas={emptyCanvas} />);
    expect(html).toContain("Waiting for article title to generate image concept");
    expect(html).not.toContain("<img");
  });

  it("shows the title-based placeholder when canvas has a title but no featured image", () => {
    const html = renderToStaticMarkup(<ImageTab canvas={titledCanvas} />);
    expect(html).toContain("AI Featured Image Placeholder");
    expect(html).toContain("How To Ship Faster");
    expect(html).not.toContain("<img");
  });

  it("renders the featured image when canvas.featuredImage is set", () => {
    const html = renderToStaticMarkup(
      <ImageTab
        canvas={{
          ...titledCanvas,
          featuredImage: {
            id: "image-1",
            url: "https://example.com/hero.png",
            alt: "Hero alt text",
            placement: { kind: "featured" },
          },
        }}
      />,
    );
    expect(html).toContain('src="https://example.com/hero.png"');
    expect(html).toContain('alt="Hero alt text"');
    expect(html).toContain('data-testid="image-tab-featured"');
    // Once the image is present the placeholder copy is no longer shown.
    expect(html).not.toContain("AI Featured Image Placeholder");
    expect(html).not.toContain("Waiting for article title");
  });

  it("renders the featured image prompt when present", () => {
    const html = renderToStaticMarkup(
      <ImageTab
        canvas={{
          ...titledCanvas,
          featuredImage: {
            id: "image-1",
            url: "https://example.com/hero.png",
            alt: "Hero alt",
            prompt: "A minimal isometric illustration of a rocket.",
            placement: { kind: "featured" },
          },
        }}
      />,
    );
    expect(html).toContain('data-testid="image-tab-prompt"');
    expect(html).toContain("A minimal isometric illustration of a rocket.");
  });

  it("renders the subtitle alongside the title concept hint", () => {
    const html = renderToStaticMarkup(
      <ImageTab
        canvas={{
          ...titledCanvas,
          subtitle: "A short narrative on velocity.",
        }}
      />,
    );
    expect(html).toContain('data-testid="image-tab-subtitle"');
    expect(html).toContain("A short narrative on velocity.");
  });
});
