import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolActivityFeed, formatRelative } from "../tool-activity-feed";
import type { ToolCallActivity } from "@/hooks/use-interview-session";

const NOW = 1_700_000_000_000;

function makeEntry(overrides: Partial<ToolCallActivity> = {}): ToolCallActivity {
  return {
    key: "call-1",
    name: "set_title",
    label: "",
    status: "applied",
    observedAt: NOW,
    ...overrides,
  };
}

describe("ToolActivityFeed", () => {
  it("renders nothing when there are no tool calls", () => {
    const html = renderToStaticMarkup(<ToolActivityFeed toolCalls={[]} />);
    expect(html).toBe("");
  });

  it("renders an aria-live log so screen readers announce new tool calls", () => {
    const html = renderToStaticMarkup(
      <ToolActivityFeed toolCalls={[makeEntry()]} />,
    );
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
  });

  it("renders the tool name and the human-friendly label", () => {
    const html = renderToStaticMarkup(
      <ToolActivityFeed
        toolCalls={[
          makeEntry({
            key: "call-2",
            name: "insert_section",
            label: "Why this matters",
          }),
        ]}
      />,
    );
    expect(html).toContain("insert_section");
    expect(html).toContain("Why this matters");
    expect(html).toContain("applied");
  });

  it("caps the rendered count to visibleCount even when more calls exist", () => {
    const entries: ToolCallActivity[] = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ key: `call-${i}`, name: `tool_${i}`, observedAt: NOW - i * 1000 }),
    );
    const html = renderToStaticMarkup(
      <ToolActivityFeed toolCalls={entries} visibleCount={3} />,
    );
    expect(html).toContain("tool_0");
    expect(html).toContain("tool_1");
    expect(html).toContain("tool_2");
    expect(html).not.toContain("tool_3");
  });

  it("renders failed rows with destructive styling and surfaces the error message", () => {
    const html = renderToStaticMarkup(
      <ToolActivityFeed
        toolCalls={[
          makeEntry({
            key: "call-3",
            name: "set_meta",
            status: "failed",
            errorMessage: "Upstream 503",
          }),
        ]}
      />,
    );
    expect(html).toContain("set_meta");
    expect(html).toContain("failed");
    expect(html).toContain("text-destructive");
    expect(html).toContain("Upstream 503");
  });

  it("uses motion-safe variants on transition utilities only — no raw colour-#### tokens", () => {
    const html = renderToStaticMarkup(
      <ToolActivityFeed
        toolCalls={[
          makeEntry({ key: "a" }),
          makeEntry({ key: "b", status: "failed" }),
        ]}
      />,
    );
    // Smooth colour transitions are present so failed/applied state swaps
    // don't snap visually.
    expect(html).toContain("transition-colors");
    // Forbid hardcoded Tailwind colour utilities — the project requires
    // semantic tokens only.
    expect(html).not.toMatch(
      /\b(?:bg|text|ring|border)-(?:red|blue|green|yellow|amber|gray|grey|slate|zinc|emerald|lime|cyan|sky|indigo|violet|purple|pink|orange|rose|teal|fuchsia)-\d{2,3}\b/,
    );
  });
});

describe("formatRelative", () => {
  it("returns 'now' for observations within the last second", () => {
    expect(formatRelative(NOW, NOW)).toBe("now");
    expect(formatRelative(NOW - 500, NOW)).toBe("now");
  });

  it("returns 'Ns ago' for older observations", () => {
    expect(formatRelative(NOW - 2_000, NOW)).toBe("2s ago");
    expect(formatRelative(NOW - 12_500, NOW)).toBe("12s ago");
  });
});
