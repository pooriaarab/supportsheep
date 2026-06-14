import { describe, expect, it } from "vitest";
import embedTweet from "./embed-tweet";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-embed-tw", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-embed-tw", worker }) };
}

describe("embed_tweet tool", () => {
  it("inserts a tweet embed from a valid twitter.com URL", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedTweet.handler(
      {
        sectionId: "section-1",
        tweetUrl: "https://twitter.com/jack/status/20",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    const block = section.blocks?.[0];
    expect(block).toMatchObject({ type: "embed", kind: "tweet" });
    expect((block as { src: string }).src).toContain(
      "platform.twitter.com/embed/Tweet.html?id=20",
    );
  });

  it("accepts an x.com URL", async () => {
    const { ctx } = makeCtx();
    const result = await embedTweet.handler(
      {
        sectionId: "section-1",
        tweetUrl: "https://x.com/elonmusk/status/1234567890",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects non-twitter URLs", () => {
    const cases = [
      "https://facebook.com/jack/status/20",
      "http://twitter.com/jack/status/20",
      "https://twitter.com/jack/",
      "https://twitter.com/jack/status/notanumber",
    ];
    for (const tweetUrl of cases) {
      const parsed = embedTweet.argsSchema.safeParse({
        sectionId: "section-1",
        tweetUrl,
      });
      expect(parsed.success).toBe(false);
    }
  });
});
