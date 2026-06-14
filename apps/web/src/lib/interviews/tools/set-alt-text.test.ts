import { describe, expect, it } from "vitest";
import setAltText from "./set-alt-text";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_alt_text tool", () => {
  it("updates alt text on an existing image", async () => {
    const worker = new WriterWorker({ interviewId: "int-alt", apiKey: "k" });
    const image = worker.setFeaturedImage({
      url: "https://example.com/hero.png",
      alt: "Old alt",
      prompt: "p",
    });
    const ctx = buildToolContext({ interviewId: "int-alt", worker });

    const result = await setAltText.handler(
      { imageId: image.id, altText: "Better alt" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().featuredImage?.alt).toBe("Better alt");
  });

  it("returns not-found for an unknown image id", async () => {
    const worker = new WriterWorker({ interviewId: "int-alt", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-alt", worker });
    const result = await setAltText.handler(
      { imageId: "image-99", altText: "x" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("rejects alt text longer than 150 chars via the Zod schema", () => {
    const parsed = setAltText.argsSchema.safeParse({
      imageId: "image-1",
      altText: "x".repeat(151),
    });
    expect(parsed.success).toBe(false);
  });
});
