import { describe, expect, it } from "vitest";
import setSeoMeta from "./set-seo-meta";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_seo_meta tool", () => {
  it("sets metaTitle and metaDescription independently", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    await setSeoMeta.handler({ metaTitle: "How I Built Solo" }, ctx);
    await setSeoMeta.handler(
      { metaDescription: "A founder's journey to launch." },
      ctx,
    );

    const canvas = worker.getCanvas();
    expect(canvas.metaTitle).toBe("How I Built Solo");
    expect(canvas.metaDescription).toBe("A founder's journey to launch.");
  });

  it("rejects calls with neither field set", () => {
    expect(setSeoMeta.argsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an over-long metaDescription", () => {
    expect(
      setSeoMeta.argsSchema.safeParse({ metaDescription: "x".repeat(161) })
        .success,
    ).toBe(false);
  });
});
