import { describe, expect, it } from "vitest";
import setSlug from "./set-slug";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_slug tool", () => {
  it("sets the canvas slug and emits slug_updated diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await setSlug.handler({ slug: "how-i-built-supportsheep" }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().slug).toBe("how-i-built-supportsheep");
    expect(diffs).toEqual([
      { type: "slug_updated", payload: { slug: "how-i-built-supportsheep" } },
    ]);
  });

  it("rejects slugs that aren't kebab-case", () => {
    expect(setSlug.argsSchema.safeParse({ slug: "How-I-Built" }).success).toBe(
      false,
    );
    expect(setSlug.argsSchema.safeParse({ slug: "a b" }).success).toBe(false);
    expect(setSlug.argsSchema.safeParse({ slug: "a_b" }).success).toBe(false);
    expect(setSlug.argsSchema.safeParse({ slug: "ok-123" }).success).toBe(true);
  });
});
