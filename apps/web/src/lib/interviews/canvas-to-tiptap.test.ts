import { describe, expect, it } from "vitest";
import {
  canvasBlockToTiptap,
  canvasToTiptap,
  parseInlineMarkdown,
} from "./canvas-to-tiptap";
import type { CanvasBlock, CanvasState } from "@/hooks/use-interview-session";

const EMPTY_CANVAS: CanvasState = {
  title: null,
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
};

describe("canvasToTiptap", () => {
  it("returns a doc with a single empty paragraph for an empty canvas", () => {
    const doc = canvasToTiptap(EMPTY_CANVAS);
    expect(doc.type).toBe("doc");
    expect(doc.content).toEqual([{ type: "paragraph" }]);
  });

  it("emits an h1 heading for the canvas title", () => {
    const doc = canvasToTiptap({ ...EMPTY_CANVAS, title: "My Article" });
    expect(doc.content[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "My Article" }],
    });
  });

  it("emits an h2 for each section heading", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      sections: [
        {
          id: "s1",
          heading: "First Section",
          bullets: [],
          paragraphs: [],
          quotes: [],
        },
      ],
    });
    expect(doc.content[0]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "First Section" }],
    });
  });

  it("converts bullets into a bulletList of listItem(paragraph) nodes", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      sections: [
        {
          id: "s1",
          heading: null,
          bullets: ["one", "two"],
          paragraphs: [],
          quotes: [],
        },
      ],
    });
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[0].content?.length).toBe(2);
    expect(doc.content[0].content?.[0]).toEqual({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
      ],
    });
  });

  it("emits paragraphs with inline marks parsed from markdown escapes", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      sections: [
        {
          id: "s1",
          heading: null,
          bullets: [],
          paragraphs: ["This is **bold** copy."],
          quotes: [],
        },
      ],
    });
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "This is " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " copy." },
      ],
    });
  });

  it("renders quotes as blockquote with attribution as italic paragraph", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      sections: [
        {
          id: "s1",
          heading: null,
          bullets: [],
          paragraphs: [],
          quotes: [{ text: "Hello", attributedTo: "Alice" }],
        },
      ],
    });
    const block = doc.content[0];
    expect(block.type).toBe("blockquote");
    expect(block.content?.length).toBe(2);
    expect(block.content?.[1].content?.[0]).toEqual({
      type: "text",
      text: "— Alice",
      marks: [{ type: "italic" }],
    });
  });

  it("preserves order: heading, bullets, paragraphs, quotes, blocks", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      title: "Title",
      sections: [
        {
          id: "s1",
          heading: "Section",
          bullets: ["bullet"],
          paragraphs: ["paragraph"],
          quotes: [{ text: "quote", attributedTo: "" }],
          blocks: [{ id: "b1", type: "divider" }],
        },
      ],
    });
    expect(doc.content.map((n) => n.type)).toEqual([
      "heading", // title h1
      "heading", // section h2
      "bulletList",
      "paragraph",
      "blockquote",
      "horizontalRule",
    ]);
  });

  it("renders the featured image as a figure node right after the title (W26.A)", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      title: "My Article",
      featuredImage: {
        id: "image-1",
        url: "https://example.com/hero.png",
        alt: "hero shot",
        placement: { kind: "featured" },
      },
    });
    // Title h1 first, then the featured figure — matches save-draft.ts
    // ordering so the in-call canvas and the saved draft agree on shape.
    expect(doc.content[0].type).toBe("heading");
    expect(doc.content[1]).toEqual({
      type: "figure",
      attrs: {
        src: "https://example.com/hero.png",
        alt: "hero shot",
        width: null,
        height: null,
      },
    });
  });

  it("renders the featured image even when the canvas has no title", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      featuredImage: {
        id: "image-1",
        url: "https://example.com/hero.png",
        alt: "hero",
        placement: { kind: "featured" },
      },
    });
    const figure = doc.content.find((n) => n.type === "figure");
    expect(figure).toBeDefined();
    expect(figure?.attrs?.src).toBe("https://example.com/hero.png");
  });

  it("renders inline images as figure nodes after the section body (W24.K)", () => {
    const doc = canvasToTiptap({
      ...EMPTY_CANVAS,
      sections: [
        {
          id: "s1",
          heading: "Body",
          bullets: [],
          paragraphs: ["lead paragraph"],
          quotes: [],
          inlineImages: [
            {
              id: "img-1",
              url: "https://example.com/monk.png",
              alt: "monk meditating",
              placement: { kind: "inline", sectionId: "s1" },
            },
          ],
        },
      ],
    });
    const figure = doc.content.find((n) => n.type === "figure");
    expect(figure).toBeDefined();
    expect(figure?.attrs).toEqual({
      src: "https://example.com/monk.png",
      alt: "monk meditating",
      width: null,
      height: null,
    });
    // Figure follows the paragraph, not before it — readers scan top-down.
    const types = doc.content.map((n) => n.type);
    expect(types.indexOf("figure")).toBeGreaterThan(types.indexOf("paragraph"));
  });
});

describe("canvasBlockToTiptap", () => {
  it("maps blockquote block to a tiptap blockquote node", () => {
    const block: CanvasBlock = {
      id: "b1",
      type: "blockquote",
      text: "Quote text",
      attribution: "Author",
    };
    const node = canvasBlockToTiptap(block);
    expect(node?.type).toBe("blockquote");
  });

  it("maps code_block to tiptap codeBlock with language attr", () => {
    const block: CanvasBlock = {
      id: "b1",
      type: "code_block",
      language: "ts",
      code: "const x = 1;",
    };
    const node = canvasBlockToTiptap(block);
    expect(node).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const x = 1;" }],
    });
  });

  it("maps callout block to a tiptap callout with the variant attr", () => {
    const block: CanvasBlock = {
      id: "b1",
      type: "callout",
      kind: "info",
      title: "FYI",
      body: "Body text",
    };
    const node = canvasBlockToTiptap(block);
    expect(node?.type).toBe("callout");
    expect(node?.attrs).toEqual({ variant: "info" });
  });

  it("maps divider to a horizontalRule", () => {
    expect(canvasBlockToTiptap({ id: "b1", type: "divider" })).toEqual({
      type: "horizontalRule",
    });
  });

  it("maps embed block to a tiptap embed node with kind+src attrs", () => {
    const block: CanvasBlock = {
      id: "b1",
      type: "embed",
      kind: "youtube",
      src: "https://www.youtube.com/embed/abc",
    };
    expect(canvasBlockToTiptap(block)).toEqual({
      type: "embed",
      attrs: { kind: "youtube", src: "https://www.youtube.com/embed/abc" },
    });
  });

  it("maps table block to rows with optional header row", () => {
    const block: CanvasBlock = {
      id: "b1",
      type: "table",
      rows: 2,
      cols: 2,
      headers: ["A", "B"],
    };
    const node = canvasBlockToTiptap(block);
    expect(node?.type).toBe("table");
    // 1 header row + 2 body rows
    expect(node?.content?.length).toBe(3);
  });
});

describe("parseInlineMarkdown", () => {
  it("returns a single text node when no marks are present", () => {
    expect(parseInlineMarkdown("plain text")).toEqual([
      { type: "text", text: "plain text" },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseInlineMarkdown("")).toEqual([]);
  });

  it("parses **bold**", () => {
    expect(parseInlineMarkdown("a **b** c")).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " c" },
    ]);
  });

  it("parses *italic* without colliding with **bold**", () => {
    expect(parseInlineMarkdown("**bold** and *italic*")).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " and " },
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ]);
  });

  it("parses ~~strike~~", () => {
    expect(parseInlineMarkdown("~~gone~~")).toEqual([
      { type: "text", text: "gone", marks: [{ type: "strike" }] },
    ]);
  });

  it("parses `code` spans", () => {
    expect(parseInlineMarkdown("use `npm install`")).toEqual([
      { type: "text", text: "use " },
      { type: "text", text: "npm install", marks: [{ type: "code" }] },
    ]);
  });

  it("parses <u>underline</u>", () => {
    expect(parseInlineMarkdown("a <u>b</u>")).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "underline" }] },
    ]);
  });

  it("parses [text](url) as a link mark", () => {
    expect(parseInlineMarkdown("[click](https://a.com)")).toEqual([
      {
        type: "text",
        text: "click",
        marks: [{ type: "link", attrs: { href: "https://a.com" } }],
      },
    ]);
  });

  it("parses <mark> highlight with color attr", () => {
    expect(
      parseInlineMarkdown('<mark data-color="yellow">hot</mark>'),
    ).toEqual([
      {
        type: "text",
        text: "hot",
        marks: [{ type: "highlight", attrs: { color: "yellow" } }],
      },
    ]);
  });

  it("returns literal text when a delimiter is unclosed (half-streamed paragraph)", () => {
    expect(parseInlineMarkdown("hello **wor")).toEqual([
      { type: "text", text: "hello **wor" },
    ]);
  });
});
