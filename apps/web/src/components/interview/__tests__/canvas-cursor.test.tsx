import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasCursor } from "../canvas-cursor";

describe("CanvasCursor", () => {
  it("renders the blinking caret + name chip when active", () => {
    const html = renderToStaticMarkup(<CanvasCursor isActive />);
    expect(html).toContain("canvas-cursor");
    expect(html).toContain("canvas-cursor-chip");
    expect(html).toContain("canvas-cursor-bar");
    expect(html).toContain("canvas-cursor-blink");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-active="true"');
    // Default label is "AI"
    expect(html).toContain(">AI<");
  });

  it("stays mounted but fades to opacity-0 when inactive", () => {
    const html = renderToStaticMarkup(<CanvasCursor isActive={false} />);
    // The cursor remains in the DOM so the CSS opacity transition can play
    // when the writer-worker goes quiet; only the `data-active` flag flips.
    expect(html).toContain('data-active="false"');
    expect(html).toContain("opacity-0");
    expect(html).toContain("canvas-cursor");
  });

  it("renders the caller-provided label in the name chip", () => {
    const html = renderToStaticMarkup(<CanvasCursor isActive label="Solo" />);
    expect(html).toContain(">Solo<");
  });

  it("applies caller-provided className", () => {
    const html = renderToStaticMarkup(
      <CanvasCursor isActive className="text-primary" />,
    );
    expect(html).toContain("text-primary");
  });
});
