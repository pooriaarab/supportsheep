import { describe, expect, it } from "vitest";
import addQuote from "./add-quote";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("add_quote tool", () => {
  it("appends a verbatim quote with attribution to the current section", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Intro" }, ctx);

    const result = await addQuote.handler(
      { text: "I love coding", attributedTo: "Speaker" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].quotes).toEqual([
      { text: "I love coding", attributedTo: "Speaker" },
    ]);
  });

  it("treats attributedTo as optional (empty string is recorded)", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });
    await addHeading.handler({ text: "X" }, ctx);

    await addQuote.handler({ text: "anonymous quote" }, ctx);
    expect(worker.getCanvas().sections[0].quotes[0]).toEqual({
      text: "anonymous quote",
      attributedTo: "",
    });
  });
});
