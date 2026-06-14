import { describe, expect, it } from "vitest";
import insertParagraph from "./insert-paragraph";
import insertSection from "./insert-section";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function setupWorker(interviewId = "int-1") {
  const worker = new WriterWorker({ interviewId, apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  const ctx = buildToolContext({ interviewId, worker });
  return { worker, ctx };
}

describe("insert_paragraph tool", () => {
  it("appends a paragraph at the end of the section and returns its id", async () => {
    const { worker, ctx } = setupWorker();
    const result = await insertParagraph.handler(
      { sectionId: "section-1", text: "First para." },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const id = result.data as { paragraphId: string };
    expect(id.paragraphId).toMatch(/^section-1-p\d+$/);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["First para."]);
    expect(worker.getCanvas().sections[0].paragraphIds).toEqual([id.paragraphId]);
  });

  it("inserts after the given paragraph id", async () => {
    const { worker, ctx } = setupWorker();
    const first = await insertParagraph.handler(
      { sectionId: "section-1", text: "A" },
      ctx,
    );
    if (!first.ok) throw new Error("first failed");
    const firstId = (first.data as { paragraphId: string }).paragraphId;
    const second = await insertParagraph.handler(
      { sectionId: "section-1", text: "C" },
      ctx,
    );
    if (!second.ok) throw new Error("second failed");
    await insertParagraph.handler(
      { sectionId: "section-1", afterParagraphId: firstId, text: "B" },
      ctx,
    );
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["A", "B", "C"]);
  });

  it("falls back to an implicit section when the requested sectionId is unknown", async () => {
    const interviewId = "int-fallback";
    const worker = new WriterWorker({ interviewId, apiKey: "k" });
    const ctx = buildToolContext({ interviewId, worker });

    expect(worker.getCanvas().sections).toHaveLength(0);

    const result = await insertParagraph.handler(
      { sectionId: "section-1", text: "Recovered paragraph." },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as {
      paragraphId: string;
      implicitSectionId?: string;
    };
    expect(data.implicitSectionId).toBeDefined();
    expect(result.summary).toContain("implicit_section=");
    expect(result.summary).toContain("requested=section-1");

    const sections = worker.getCanvas().sections;
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe(data.implicitSectionId);
    expect(sections[0].heading).toBe("Untitled section");
    expect(sections[0].paragraphs).toEqual(["Recovered paragraph."]);
    expect(sections[0].paragraphIds).toEqual([data.paragraphId]);
  });

  it("rejects afterParagraphId on the implicit-section fallback path", async () => {
    const interviewId = "int-fallback-after";
    const worker = new WriterWorker({ interviewId, apiKey: "k" });
    const ctx = buildToolContext({ interviewId, worker });

    const result = await insertParagraph.handler(
      {
        sectionId: "section-1",
        afterParagraphId: "section-1-p1",
        text: "X",
      },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("returns not-found when afterParagraphId is unknown", async () => {
    const { ctx } = setupWorker();
    const result = await insertParagraph.handler(
      { sectionId: "section-1", afterParagraphId: "section-1-p99", text: "X" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("regression: 5 rapid insert_section + insert_paragraph pairs (no awaited write between) all succeed", async () => {
    const interviewId = "int-rapid";
    const worker = new WriterWorker({ interviewId, apiKey: "k" });
    const ctx = buildToolContext({ interviewId, worker });

    // Fire pairs concurrently — each pair calls insertSection synchronously
    // (returning the freshly minted id), then immediately addresses
    // insertParagraph against it. Mirrors the realtime model's batched
    // tool_call burst from the W14 SSE trace where insert_section and
    // insert_paragraph land back-to-back with no intervening tool_result
    // round-trip.
    const pairs = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const sec = await insertSection.handler(
          { heading: `Heading ${i + 1}`, level: 2 },
          ctx,
        );
        if (!sec.ok) throw new Error(`section ${i + 1} insert failed`);
        const sectionId = (sec.data as { sectionId: string }).sectionId;
        const para = await insertParagraph.handler(
          { sectionId, text: `Paragraph ${i + 1}.` },
          ctx,
        );
        return { sec, sectionId, para };
      }),
    );

    for (const { sec, para } of pairs) {
      expect(sec.ok).toBe(true);
      expect(para.ok).toBe(true);
      if (para.ok) {
        // Crucially: no implicit-section fallback. The paragraph
        // landed in the exact section insert_section returned.
        const data = para.data as { implicitSectionId?: string };
        expect(data.implicitSectionId).toBeUndefined();
      }
    }

    const sections = worker.getCanvas().sections;
    expect(sections).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(sections[i].paragraphs).toEqual([`Paragraph ${i + 1}.`]);
    }
  });
});
