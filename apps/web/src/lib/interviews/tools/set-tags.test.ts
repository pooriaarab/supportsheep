import { describe, expect, it } from "vitest";
import setTags from "./set-tags";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_tags tool", () => {
  it("normalises tag names to lowercase and dedupes them", async () => {
    const worker = new WriterWorker({ interviewId: "int-tags", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-tags", worker });
    const result = await setTags.handler(
      { tagNames: [" Voice ", "voice", "AI"] },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().tags).toEqual(["voice", "ai"]);
  });

  it("rejects more than 8 tags via the Zod schema", () => {
    const parsed = setTags.argsSchema.safeParse({
      tagNames: Array.from({ length: 9 }, (_, i) => `t${i}`),
    });
    expect(parsed.success).toBe(false);
  });
});
