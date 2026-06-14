import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasTipTapEditor } from "../canvas-tiptap-editor";
import type { CanvasState } from "@/hooks/use-interview-session";

const baseCanvas: CanvasState = {
  title: "Test article",
  sections: [
    {
      id: "section-1",
      heading: "Intro heading",
      bullets: ["First bullet"],
      paragraphs: ["A paragraph the human can edit."],
      quotes: [],
    },
    {
      id: "section-2",
      heading: "Second section",
      bullets: [],
      paragraphs: ["Another paragraph."],
      quotes: [],
    },
  ],
  meta: { description: null, tags: [], suggestedCategory: null },
};

describe("CanvasTipTapEditor", () => {
  it("renders editable canvas structure with section and heading inputs", () => {
    const html = renderToStaticMarkup(
      <CanvasTipTapEditor canvas={baseCanvas} onEdit={vi.fn()} />,
    );
    expect(html).toContain("Test article");
    expect(html).toContain('data-testid="canvas-editable"');
    expect(html).toContain('data-testid="canvas-section-section-1"');
    expect(html).toContain('data-testid="canvas-section-section-2"');
    // Heading rendered as a text input so the human can edit inline.
    expect(html).toContain('aria-label="Section section-1 heading"');
    expect(html).toContain("Intro heading");
  });

  it("renders the 'AI considering your edit' indicator when the section is in the pending set", () => {
    const html = renderToStaticMarkup(
      <CanvasTipTapEditor
        canvas={baseCanvas}
        pendingAiSections={new Set(["section-1"])}
        onEdit={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="ai-considering-section-1"');
    expect(html).toContain("AI considering your edit");
    // Other sections should NOT show it.
    expect(html).not.toContain('data-testid="ai-considering-section-2"');
  });

  it("renders an 'AI proposed change' pill with accept/dismiss buttons for pending proposals", () => {
    const html = renderToStaticMarkup(
      <CanvasTipTapEditor
        canvas={baseCanvas}
        proposals={[
          {
            sectionId: "section-1",
            index: 0,
            humanValue: "Human version.",
            aiValue: "AI version.",
          },
        ]}
        onEdit={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="proposal-pill-section-1-0"');
    expect(html).toContain("AI proposed a different version");
    expect(html).toContain(">Accept<");
    expect(html).toContain(">Dismiss<");
  });
});
