import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadyTab } from "../ready-tab";
import type { CanvasState } from "@/hooks/use-interview-session";

const emptyCanvas: CanvasState = {
  title: null,
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
};

const canvasWithQuotes: CanvasState = {
  title: "Lessons from a year of shipping",
  sections: [
    {
      id: "s1",
      heading: "Why velocity wins",
      bullets: [],
      paragraphs: ["Faster iteration drives more learning."],
      quotes: [
        {
          text: "We shipped six betas before our competitor's first launch.",
          attributedTo: "Jane Doe",
        },
      ],
    },
    {
      id: "s2",
      heading: "Compound effects",
      bullets: [],
      paragraphs: [],
      quotes: [
        {
          text: "Each cycle teaches us what to cut next.",
          attributedTo: "Jane Doe",
        },
      ],
    },
  ],
  meta: { description: null, tags: [], suggestedCategory: null },
};

describe("ReadyTab", () => {
  it("renders the EEAT score block even with an empty canvas", () => {
    const html = renderToStaticMarkup(<ReadyTab canvas={emptyCanvas} />);
    expect(html).toContain("E-E-A-T Score");
    expect(html).toContain('data-testid="eeat-verbatim-count"');
    expect(html).toContain("Waiting for the conversation to start");
  });

  it("shows the empty-but-active state once canvas has content but no quotes", () => {
    const html = renderToStaticMarkup(
      <ReadyTab
        canvas={{
          ...emptyCanvas,
          title: "Title only",
          sections: [
            { id: "s1", heading: "H", bullets: [], paragraphs: ["p"], quotes: [] },
          ],
        }}
      />,
    );
    expect(html).toContain("Direct quotes from the guest will appear here");
    expect(html).not.toContain('data-testid="eeat-verbatim-quote"');
  });

  it("renders verbatim direct quotes from canvas sections", () => {
    const html = renderToStaticMarkup(
      <ReadyTab canvas={canvasWithQuotes} guestName="Jane Doe" />,
    );
    expect(html).toContain('data-testid="eeat-verbatim-quote"');
    expect(html).toContain("We shipped six betas");
    expect(html).toContain("Each cycle teaches us what to cut next");
    expect(html).toContain("Jane Doe");
    // Count surfaces the 2 quotes
    expect(html).toContain("2 quotes");
  });

  it("uses singular 'quote' label for a single quote", () => {
    const html = renderToStaticMarkup(
      <ReadyTab
        canvas={{
          ...emptyCanvas,
          title: "T",
          sections: [
            {
              id: "s1",
              heading: null,
              bullets: [],
              paragraphs: [],
              quotes: [{ text: "Just one quote.", attributedTo: "Guest" }],
            },
          ],
        }}
        guestName="Guest"
      />,
    );
    expect(html).toContain("1 quote");
    expect(html).not.toContain("1 quotes");
  });

  it("flips the guest-attribution signal to Active when guestName is provided", () => {
    const html = renderToStaticMarkup(
      <ReadyTab canvas={canvasWithQuotes} guestName="Jane Doe" />,
    );
    // The guest-attribution row's status text is "Active" in this case.
    expect(html).toMatch(/Guest Speaker Attribution[\s\S]*Active/);
  });

  it("skips blank quote entries", () => {
    const html = renderToStaticMarkup(
      <ReadyTab
        canvas={{
          ...emptyCanvas,
          title: "T",
          sections: [
            {
              id: "s1",
              heading: null,
              bullets: [],
              paragraphs: [],
              quotes: [
                { text: "   ", attributedTo: "Guest" },
                { text: "Real quote.", attributedTo: "Guest" },
              ],
            },
          ],
        }}
      />,
    );
    expect(html).toContain("1 quote");
    expect(html).toContain("Real quote.");
  });
});
