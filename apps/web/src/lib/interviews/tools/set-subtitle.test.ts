import { describe, expect, it } from "vitest";
import setSubtitle from "./set-subtitle";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_subtitle tool", () => {
  it("sets the canvas subtitle and emits subtitle_updated diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await setSubtitle.handler(
      { text: "A founder's journey" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().subtitle).toBe("A founder's journey");
    expect(diffs).toEqual([
      {
        type: "subtitle_updated",
        payload: { subtitle: "A founder's journey" },
      },
    ]);
  });

  it("rejects empty and over-long subtitles", () => {
    expect(setSubtitle.argsSchema.safeParse({ text: "" }).success).toBe(false);
    expect(
      setSubtitle.argsSchema.safeParse({ text: "x".repeat(251) }).success,
    ).toBe(false);
  });
});
