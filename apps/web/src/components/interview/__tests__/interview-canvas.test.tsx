import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InterviewCanvas } from "../interview-canvas";
import type { CanvasState, WriterActivity } from "@/hooks/use-interview-session";

const mockCanvas: CanvasState = {
  title: "Building Great Software Products",
  sections: [
    {
      id: "section-1",
      heading: "Focus on Developer Velocity",
      bullets: ["Keep your loops short", "Automate checks on commit"],
      paragraphs: ["Developer velocity is a critical metric for scaling teams."],
      quotes: [{ text: "Move fast but don't break the build", attributedTo: "Senior Dev" }],
    },
  ],
  meta: {
    description: "This article talks about software design patterns.",
    tags: ["velocity", "quality"],
    suggestedCategory: "Engineering",
  },
};

const idleActivity: WriterActivity = {
  isAppending: false,
  lastWriteSectionId: null,
  hasEmptyTrailingSection: false,
};

describe("InterviewCanvas", () => {
  it("does not render the legacy Body/Image/SEO/EEAT tabs (post-W19b/c the body is the canvas)", () => {
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={mockCanvas} writerActivity={idleActivity} />,
    );
    // The Body tab label is gone — the editor itself IS the body now.
    expect(html).not.toContain(">Body<");
    // SEO / Image / EEAT live in the right sidebar (CanvasRightSidebar),
    // not in the body canvas wrapper.
    expect(html).not.toMatch(/role="tab"[^>]*>SEO</);
    expect(html).not.toMatch(/role="tab"[^>]*>Image</);
    expect(html).not.toMatch(/role="tab"[^>]*>EEAT</);
  });

  it("renders the canvas inside the collaborative TipTap editor", () => {
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={mockCanvas} writerActivity={idleActivity} />,
    );

    // The body content is now driven by a full TipTap editor (editable,
    // not read-only). The SSR pass renders its wrapper container.
    expect(html).toContain("canvas-collaborative-editor");
    // The editing hint should be absent when the writer is idle.
    expect(html).not.toContain("canvas-collaborative-editor-editing-hint");
  });

  it("mounts the editable TipTap canvas (no empty-state overlay) when the canvas is empty", () => {
    const emptyCanvas: CanvasState = {
      title: null,
      sections: [],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={emptyCanvas} writerActivity={idleActivity} topic="My Interview Topic" />,
    );
    // The editor mounts immediately so the user can start typing — there
    // is no "Your story begins here" overlay to dismiss.
    expect(html).toContain("canvas-collaborative-editor");
    expect(html).not.toContain("Your story begins here");
    expect(html).not.toContain("canvas-collaborative-editor-empty-headline");
    expect(html).not.toContain("Awaiting first scaffolding");
    expect(html).not.toContain("AI is preparing the outline");
  });

  it("renders a writing-sound toggle button (muted by default)", () => {
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={mockCanvas} writerActivity={idleActivity} />,
    );
    expect(html).toContain("Unmute writing sound");
  });

  it("renders the 'AI is editing' hint when the writer is actively appending", () => {
    const activeActivity: WriterActivity = {
      isAppending: true,
      lastWriteSectionId: "section-1",
      hasEmptyTrailingSection: false,
    };
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={mockCanvas} writerActivity={activeActivity} />,
    );
    expect(html).toContain("canvas-collaborative-editor-editing-hint");
    expect(html).toContain("canvas-cursor");
  });

  it("renders a skeleton placeholder when a scaffolded section has no content", () => {
    const scaffoldedCanvas: CanvasState = {
      title: "Title",
      sections: [
        { id: "s1", heading: null, bullets: [], paragraphs: [], quotes: [] },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    const html = renderToStaticMarkup(
      <InterviewCanvas
        canvas={scaffoldedCanvas}
        writerActivity={{ isAppending: false, lastWriteSectionId: null, hasEmptyTrailingSection: true }}
      />,
    );
    expect(html).toContain("canvas-skeleton");
    expect(html).toContain("AI is preparing the next section");
  });

  it("does not render a thinking dots indicator below the body (orb is the AI activity signal)", () => {
    const html = renderToStaticMarkup(
      <InterviewCanvas canvas={mockCanvas} writerActivity={idleActivity} />,
    );
    expect(html).not.toContain("canvas-thinking-dots");
    expect(html).not.toContain("AI is thinking");
  });
});
