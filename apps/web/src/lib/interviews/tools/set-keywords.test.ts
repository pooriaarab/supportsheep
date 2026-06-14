import { describe, expect, it } from "vitest";
import setKeywords from "./set-keywords";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_keywords tool", () => {
  it("applies normalised, deduped keywords to the canvas", async () => {
    const worker = new WriterWorker({ interviewId: "int-kw", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-kw", worker });
    const result = await setKeywords.handler(
      { keywords: ["seo", "  seo  ", "voice"] },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().keywords).toEqual(["seo", "voice"]);
  });

  it("rejects more than 10 keywords via the Zod schema", () => {
    const parsed = setKeywords.argsSchema.safeParse({
      keywords: Array.from({ length: 11 }, (_, i) => `k${i}`),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a keyword longer than 50 chars", () => {
    const parsed = setKeywords.argsSchema.safeParse({
      keywords: ["x".repeat(51)],
    });
    expect(parsed.success).toBe(false);
  });
});
