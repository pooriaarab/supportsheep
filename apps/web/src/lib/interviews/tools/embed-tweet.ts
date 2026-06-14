import { z } from "zod";
import type { Tool } from "./_types";
import { TWEET_URL_REGEX } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  tweetUrl: z.string().regex(TWEET_URL_REGEX, {
    message:
      "tweetUrl must match https://(twitter|x).com/{handle}/status/{tweet_id}",
  }),
});

/**
 * Embed a tweet (X post) by canonical URL. The URL is validated
 * against `TWEET_URL_REGEX` to ensure it's pointing at twitter.com
 * or x.com — anything else returns a validation error rather than
 * silently rendering an arbitrary URL in an iframe.
 *
 * The embed src is the publisher's official oEmbed/Iframe surface
 * (`platform.twitter.com/embed/Tweet.html?id=…`) so the iframe stays
 * on the official domain and inherits Twitter's sandbox policies.
 */
export default {
  name: "embed_tweet",
  description:
    "Embed a tweet/X post from twitter.com or x.com by URL. URL is validated to match the canonical /status/ pattern.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `tweet:${args.tweetUrl}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    // Extract the numeric tweet id from the URL — the regex already
    // matched, so the capture is guaranteed safe.
    const match = args.tweetUrl.match(/\/status\/(\d{1,25})/);
    const tweetId = match?.[1] ?? "";
    const src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`;
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "tweet",
      src,
      attrs: { tweetUrl: args.tweetUrl, tweetId },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src }, summary: "tweet_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
