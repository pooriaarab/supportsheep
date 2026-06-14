import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  summarizeUserEdit,
  summarizeUserEditFromDoc,
} from "./user-edit-summary";

describe("summarizeUserEdit (plain-text fallback)", () => {
  it("returns null when nothing meaningful changed", () => {
    expect(summarizeUserEdit("", "")).toBeNull();
    expect(summarizeUserEdit("hello world", "hello world")).toBeNull();
    expect(summarizeUserEdit("hello world", "  hello   world  ")).toBeNull();
  });

  it("returns null when only whitespace was appended (W24.I: no empty-bodied cue)", () => {
    expect(
      summarizeUserEdit("What Is Solo Grow", "What Is Solo Grow   "),
    ).toBeNull();
    expect(
      summarizeUserEdit("What Is Solo Grow", "What Is Solo Grow\n\n"),
    ).toBeNull();
  });

  it("quotes the verbatim user text when they type a new line — never an empty body (W24.I)", () => {
    const summary = summarizeUserEdit(
      "What Is Solo Grow",
      "What Is Solo Grow hello world",
    );
    expect(summary).not.toBeNull();
    expect(summary?.cueText).toContain("hello world");
    expect(summary?.cueText).not.toMatch(/added new text to the canvas: ""/);
    expect(summary?.cueText).not.toMatch(/user edited the doc/i);
  });

  it("describes a pure suffix addition as 'added new text' with the new tail verbatim", () => {
    const summary = summarizeUserEdit(
      "BlogBat helps founders ship blogs.",
      "BlogBat helps founders ship blogs. It runs on Firebase.",
    );
    expect(summary).not.toBeNull();
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/added new text to the canvas/i);
    expect(summary?.cueText).toContain("It runs on Firebase.");
    expect(summary?.cueText).toMatch(/acknowledge their edit naturally/i);
  });

  it("describes a pure suffix deletion as 'removed text from the end'", () => {
    const summary = summarizeUserEdit(
      "BlogBat helps founders ship blogs. It runs on Firebase.",
      "BlogBat helps founders ship blogs.",
    );
    expect(summary?.kind).toBe("removed");
    expect(summary?.cueText).toMatch(/removed text/i);
    expect(summary?.cueText).toContain("It runs on Firebase.");
  });

  it("describes writing from an empty canvas as a fresh write", () => {
    const summary = summarizeUserEdit("", "Drafting the opening line.");
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/wrote on the canvas/i);
    expect(summary?.cueText).toContain("Drafting the opening line.");
  });

  it("describes a mid-document line edit using the changed line", () => {
    const before = ["Heading", "First paragraph.", "Second paragraph."].join("\n");
    const after = ["Heading", "First paragraph reworked.", "Second paragraph."].join("\n");
    const summary = summarizeUserEdit(before, after);
    expect(summary?.kind).toBe("edited");
    expect(summary?.cueText).toContain("First paragraph reworked.");
    expect(summary?.cueText).toMatch(/changed line/i);
  });

  it("never dumps a giant block verbatim — long additions are clipped with an ellipsis", () => {
    const long = "word ".repeat(500).trim();
    const summary = summarizeUserEdit("", long);
    expect(summary).not.toBeNull();
    expect(summary?.cueText).toMatch(/…/);
    expect(summary?.cueText.length).toBeLessThan(800);
  });

  it("escapes user-supplied double quotes so the wrapper quote stays unambiguous", () => {
    const summary = summarizeUserEdit(
      "",
      'She said "ship it" and walked away.',
    );
    expect(summary).not.toBeNull();
    expect(summary?.cueText).not.toMatch(/"ship it"/);
    expect(summary?.cueText).toMatch(/'ship it'/);
  });
});

// Helpers for building tiny ProseMirror doc fixtures inline.
function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}
function p(text = ""): JSONContent {
  return text.length === 0
    ? { type: "paragraph" }
    : { type: "paragraph", content: [{ type: "text", text }] };
}
function h(level: number, text = ""): JSONContent {
  return text.length === 0
    ? { type: "heading", attrs: { level } }
    : {
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text }],
      };
}
function bulletList(...items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}
function image(attrs: { src?: string; alt?: string } = {}): JSONContent {
  return { type: "image", attrs };
}
function codeBlock(text = "", language?: string): JSONContent {
  return {
    type: "codeBlock",
    attrs: language ? { language } : {},
    content: text ? [{ type: "text", text }] : undefined,
  };
}
function horizontalRule(): JSONContent {
  return { type: "horizontalRule" };
}
function table(): JSONContent {
  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
          },
        ],
      },
    ],
  };
}
function callout(text: string): JSONContent {
  return {
    type: "callout",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}
function youtubeEmbed(src: string): JSONContent {
  return { type: "youtube", attrs: { src } };
}

describe("summarizeUserEditFromDoc (structural cues for every TipTap node)", () => {
  it("returns null when neither structure nor text changed", () => {
    const a = doc(p("Hello"));
    const b = doc(p("Hello"));
    expect(summarizeUserEditFromDoc(a, b)).toBeNull();
  });

  it("describes a new H2 heading by level and content (W25.A: structural diff)", () => {
    const before = doc(p("Existing intro."));
    const after = doc(p("Existing intro."), h(2, "Why we built it"));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/H2 heading/);
    expect(summary?.cueText).toContain("Why we built it");
    expect(summary?.cueText).not.toMatch(/added new text to the canvas: ""/);
  });

  it("describes an empty heading insert without an empty-bodied cue", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), h(1, ""));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary).not.toBeNull();
    expect(summary?.cueText).toMatch(/empty H1 heading/);
    expect(summary?.cueText).not.toMatch(/: ""/);
  });

  it("describes an inserted image — surfaces alt/src so the AI can quote it back", () => {
    const before = doc(p("Intro."));
    const after = doc(
      p("Intro."),
      image({ src: "https://example.com/hero.png", alt: "founders shipping" }),
    );
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/inserted an image/i);
    expect(summary?.cueText).toContain("founders shipping");
  });

  it("describes a code block with its language", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), codeBlock("console.log('hi')", "javascript"));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/code block \(javascript\)/);
    expect(summary?.cueText).toContain("console.log('hi')");
  });

  it("describes a new bulleted list by item count and joined items", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), bulletList("alpha", "beta", "gamma"));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/bulleted list/i);
    expect(summary?.cueText).toMatch(/3 items/);
    expect(summary?.cueText).toContain("alpha");
    expect(summary?.cueText).toContain("gamma");
  });

  it("describes a horizontal rule insert", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), horizontalRule());
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.cueText).toMatch(/horizontal rule/i);
    expect(summary?.cueText).not.toMatch(/: ""/);
  });

  it("describes a table insert", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), table());
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.cueText).toMatch(/table/i);
  });

  it("describes a callout insert with its body text", () => {
    const before = doc(p("Intro."));
    const after = doc(p("Intro."), callout("watch out for races"));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.cueText).toMatch(/callout/i);
    expect(summary?.cueText).toContain("watch out for races");
  });

  it("describes a YouTube embed by its URL", () => {
    const before = doc(p("Intro."));
    const after = doc(
      p("Intro."),
      youtubeEmbed("https://youtube.com/watch?v=xyz"),
    );
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.cueText).toMatch(/youtube|embed/i);
    expect(summary?.cueText).toContain("xyz");
  });

  it("describes a removed structural node", () => {
    const before = doc(p("Intro."), image({ src: "https://x.com/y.png" }));
    const after = doc(p("Intro."));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("removed");
    expect(summary?.cueText).toMatch(/removed an image/i);
  });

  it("falls back to text diff for plain-text edits inside an unchanged structure", () => {
    const before = doc(p("BlogBat helps founders ship blogs."));
    const after = doc(p("BlogBat helps founders ship blogs. It runs on Firebase."));
    const summary = summarizeUserEditFromDoc(before, after);
    expect(summary?.kind).toBe("added");
    expect(summary?.cueText).toMatch(/added new text to the canvas/i);
    expect(summary?.cueText).toContain("It runs on Firebase.");
  });

  it("returns null for a no-op selection-only mutation (no doc change)", () => {
    const a = doc(p("Hello"), p("World"));
    const b = doc(p("Hello"), p("World"));
    expect(summarizeUserEditFromDoc(a, b)).toBeNull();
  });

  it("never emits a structural cue with an empty-quoted body (W24.I + W25.A regression)", () => {
    // A handful of structural inserts whose nodes carry no text. Each
    // must produce a non-null cue and must NOT have `: ""` in it.
    const cases = [
      [doc(p("x")), doc(p("x"), horizontalRule())],
      [doc(p("x")), doc(p("x"), h(3, ""))],
      [doc(p("x")), doc(p("x"), image({ src: "https://x" }))],
    ] as const;
    for (const [before, after] of cases) {
      const summary = summarizeUserEditFromDoc(before, after);
      expect(summary).not.toBeNull();
      expect(summary?.cueText).not.toMatch(/: ""/);
    }
  });
});
