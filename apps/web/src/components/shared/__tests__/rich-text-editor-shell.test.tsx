import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichTextEditorShell } from "../rich-text-editor-shell";
import type { SlashCommandState } from "@/lib/tiptap";

const idleSlashState: SlashCommandState = {
  active: false,
  query: "",
  slashPos: 0,
  coords: null,
};

describe("RichTextEditorShell", () => {
  it("renders the centred prose column with shared spacing", () => {
    const html = renderToStaticMarkup(
      <RichTextEditorShell editor={null} data-testid="shell" />,
    );
    // Centred prose column width — must match the canonical max-w-3xl used by
    // both the article editor and the in-call canvas so the surfaces stay
    // visually identical.
    expect(html).toContain("max-w-3xl");
    expect(html).toContain("px-6 md:px-10");
    expect(html).toContain('data-testid="shell"');
  });

  it("renders the topSlot above the editor content", () => {
    const html = renderToStaticMarkup(
      <RichTextEditorShell
        editor={null}
        topSlot={<div data-testid="title-slot">Title</div>}
      />,
    );
    expect(html).toContain('data-testid="title-slot"');
  });

  it("renders an overlay slot for absolutely-positioned UI (e.g. AI cursor)", () => {
    const html = renderToStaticMarkup(
      <RichTextEditorShell
        editor={null}
        overlay={<div data-testid="overlay-slot">Overlay</div>}
      />,
    );
    expect(html).toContain('data-testid="overlay-slot"');
  });

  it("omits the slash menu when no slashState is supplied", () => {
    const html = renderToStaticMarkup(<RichTextEditorShell editor={null} />);
    // The slash menu only mounts when its plugin reports active === true,
    // so even without props the rendered HTML must not include its popover.
    expect(html).not.toContain("rounded-lg border border-border bg-popover shadow-lg");
  });

  it("wires through the slashState when provided", () => {
    const html = renderToStaticMarkup(
      <RichTextEditorShell editor={null} slashState={idleSlashState} />,
    );
    // The menu stays hidden because state.active is false; this assertion is
    // just confirming the shell accepts the prop without throwing.
    expect(html).toContain("max-w-3xl");
  });
});
