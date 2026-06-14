import { describe, expect, it } from "vitest";
import getWordCount from "./get-word-count";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import addQuote from "./add-quote";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("get_word_count tool", () => {
  it("counts words across the whole canvas when target omitted", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Intro" }, ctx);
    await addBullet.handler({ text: "two words" }, ctx); // 2 words
    await addBullet.handler({ text: "three more words" }, ctx); // 3 words
    await addQuote.handler({ text: "four word quote here" }, ctx); // 4 words

    const result = await getWordCount.handler({}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { scope: string; words: number };
      expect(data.scope).toBe("all");
      expect(data.words).toBe(9);
    }
  });

  it("counts words for a specific section when target is a section id", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });
    await addHeading.handler({ text: "S1" }, ctx);
    await addBullet.handler({ text: "one two three" }, ctx);
    await addHeading.handler({ text: "S2" }, ctx);
    await addBullet.handler({ text: "four five" }, ctx);

    const r1 = await getWordCount.handler({ target: "section-1" }, ctx);
    const r2 = await getWordCount.handler({ target: "section-2" }, ctx);
    expect(r1.ok && (r1.data as { words: number }).words).toBe(3);
    expect(r2.ok && (r2.data as { words: number }).words).toBe(2);
  });

  it("returns not-found for unknown section id", async () => {
    const worker = new WriterWorker({ interviewId: "int-3", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-3", worker });

    const result = await getWordCount.handler({ target: "section-nope" }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("not-found");
    }
  });

  it("returns 0 for an empty canvas", async () => {
    const worker = new WriterWorker({ interviewId: "int-empty", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-empty", worker });
    const result = await getWordCount.handler({}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { words: number }).words).toBe(0);
    }
  });
});
