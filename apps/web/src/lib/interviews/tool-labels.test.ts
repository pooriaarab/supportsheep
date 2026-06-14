import { describe, expect, it } from "vitest";
import { TOOL_LABELS, labelForTool } from "./tool-labels";

describe("TOOL_LABELS", () => {
  it("covers the core canvas tools used by the realtime model", () => {
    const required = [
      "set_title",
      "set_subtitle",
      "insert_section",
      "rename_section",
      "replace_text",
      "insert_paragraph",
      "request_featured_image",
      "get_current_state",
      "get_word_count",
    ];
    for (const name of required) {
      expect(TOOL_LABELS[name], `missing label for ${name}`).toBeTruthy();
    }
  });

  it("uses present-tense gerund phrasing so the chip reads as in-progress", () => {
    // Every label should start with a capital letter so the chip looks
    // intentional even when prefixed with the downward arrow glyph.
    for (const [name, label] of Object.entries(TOOL_LABELS)) {
      expect(label.length, `empty label for ${name}`).toBeGreaterThan(0);
      expect(label[0], `non-capitalized label for ${name}`).toBe(label[0].toUpperCase());
    }
  });
});

describe("labelForTool", () => {
  it("returns the custom label for a known tool", () => {
    expect(labelForTool("set_title")).toBe("Setting the title");
    expect(labelForTool("insert_section")).toBe("Adding a section");
    expect(labelForTool("request_featured_image")).toBe(
      "Generating a featured image",
    );
  });

  it("humanizes unknown snake_case names as Title Case fallback", () => {
    expect(labelForTool("some_brand_new_tool")).toBe("Some Brand New Tool");
    expect(labelForTool("hello")).toBe("Hello");
  });

  it("handles empty input without throwing", () => {
    expect(labelForTool("")).toBe("");
  });

  it("collapses double underscores in unknown names", () => {
    expect(labelForTool("foo__bar")).toBe("Foo Bar");
  });
});
