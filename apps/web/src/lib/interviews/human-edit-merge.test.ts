import { describe, it, expect } from "vitest";
import {
  mergeParagraphEdit,
  formatHumanEditsForPrompt,
  type HumanEditEntry,
} from "./human-edit-merge";

describe("mergeParagraphEdit", () => {
  it("accepts the AI value when the human has not touched the paragraph", () => {
    const result = mergeParagraphEdit("old text", "old text", "new text");
    expect(result).toEqual({ kind: "accept", value: "new text" });
  });

  it("splices the AI value into a human-extended paragraph that still contains the AI's prior text", () => {
    const humanValue = "Prefix added by human. old text — and a postscript.";
    const result = mergeParagraphEdit(humanValue, "old text", "new text");
    expect(result).toEqual({
      kind: "splice",
      value: "Prefix added by human. new text — and a postscript.",
    });
  });

  it("returns a proposed merge when the human rewrote the paragraph and the AI's prior text is no longer present", () => {
    const result = mergeParagraphEdit(
      "Totally rewritten by the human.",
      "AI's original",
      "AI's polished version",
    );
    expect(result).toEqual({
      kind: "proposed",
      humanValue: "Totally rewritten by the human.",
      aiValue: "AI's polished version",
    });
  });

  it("accepts the AI value when there is no prior AI text and the human value is empty", () => {
    const result = mergeParagraphEdit("", "", "fresh content");
    expect(result).toEqual({ kind: "accept", value: "fresh content" });
  });

  it("proposes a change when there is no prior AI text but the human has already typed something", () => {
    const result = mergeParagraphEdit("human-only draft", "", "ai suggestion");
    expect(result).toEqual({
      kind: "proposed",
      humanValue: "human-only draft",
      aiValue: "ai suggestion",
    });
  });
});

describe("formatHumanEditsForPrompt", () => {
  it("returns an empty string when there are no edits", () => {
    expect(formatHumanEditsForPrompt([])).toBe("");
  });

  it("formats a short list of edits with the do-not-revert preamble", () => {
    const edits: HumanEditEntry[] = [
      { sectionId: "intro", field: "heading", value: "My Real Heading" },
      {
        sectionId: "main",
        field: "paragraph_text",
        index: 2,
        value: "Human-edited paragraph.",
      },
      {
        sectionId: "main",
        field: "bullet_text",
        index: 0,
        value: "Bullet point I rewrote.",
      },
    ];
    const out = formatHumanEditsForPrompt(edits);
    expect(out).toContain("Recent human edits");
    expect(out).toContain("§intro heading");
    expect(out).toContain("§main p2");
    expect(out).toContain("§main bullet 0");
    expect(out).toContain("DO NOT undo");
  });

  it("limits to the 5 most recent edits by default", () => {
    const edits: HumanEditEntry[] = Array.from({ length: 12 }, (_, i) => ({
      sectionId: `s${i}`,
      field: "heading" as const,
      value: `Heading ${i}`,
    }));
    const out = formatHumanEditsForPrompt(edits);
    // Most recent 5 are s7..s11
    expect(out).toContain("§s11 heading");
    expect(out).toContain("§s7 heading");
    expect(out).not.toContain("§s6 heading");
  });

  it("truncates very long values to the configured max chars with an ellipsis", () => {
    const longValue = "x".repeat(500);
    const edits: HumanEditEntry[] = [
      { sectionId: "s1", field: "heading", value: longValue },
    ];
    const out = formatHumanEditsForPrompt(edits, { maxChars: 50 });
    expect(out).toContain("…"); // ellipsis
    // Should contain at most 50 'x's followed by ellipsis
    expect(out).not.toContain("x".repeat(60));
  });
});
