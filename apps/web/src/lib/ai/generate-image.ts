import "server-only";

import { randomUUID } from "crypto";

import OpenAI from "openai";
import { getMediaBucket } from "@/lib/media/bucket";
import { getProviderApiKey } from "@/lib/ai/providers";
import { searchUnsplash, UnsplashNotConfiguredError } from "@/lib/ai/unsplash";
import type { UnsplashAttribution } from "@/lib/ai/unsplash";
import { createLogger } from "@/lib/logger";

const log = createLogger("generate-image");

const PROMPT_MODEL = "gpt-5.5";
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_QUALITY = "high" as const;

const SYSTEM_PROMPT = `You are an editorial photography art director for a professional blog. Write a vivid text-to-image prompt for a blog featured image based on the article title, excerpt, and category.

Rules: (1) exactly one person doing one physical action; (2) no screens, laptops, monitors, phones, or visible text anywhere; (3) describe the person specifically (age, appearance, ethnicity, clothing); (4) show the subject through real physical action in a real location.

CRITICAL — vary the composition every time. NEVER default to "person sitting at a table looking down." Choose a shot type and angle that fits the action and feels distinct:
- Shot types to rotate: wide establishing shot, tight close-up on hands/face, low-angle looking up, high-angle bird's eye, over-shoulder, silhouette against light, action mid-motion, environmental portrait
- Actions to consider: walking, kneeling, reaching, climbing, standing outdoors, leaning against something, crouching, mid-gesture
- Environments: outdoors in natural light, a workshop, a street, a clinic, a garden, a hallway — not always indoors at a table

Use cinematic language: lighting quality, specific shot type and angle, lens, depth of field. Output ONLY the prompt string, max 110 words, no preamble, no quotes.`;

export type ImageSource = "unsplash" | "ai";

export interface GenerateImageOptions {
  title: string;
  excerpt?: string;
  category?: string;
  imageStyle?: string;
  imageColorScheme?: string;
  imageAspectRatio?: string;
  storagePrefix?: string;
  purpose?: "featured-image" | "inline";
  customPrompt?: string;
  /**
   * Preferred image source. `unsplash` uses the search API for stock
   * photography (free, low latency). `ai` falls back to gpt-image-1
   * for abstract / illustrative concepts. Defaults to `ai` when no
   * `query` is provided.
   */
  source?: ImageSource;
  /**
   * Short Unsplash search query (3-5 words). Required when
   * `source === "unsplash"`; ignored otherwise.
   */
  query?: string;
}

export interface GenerateImageResult {
  url: string;
  alt: string;
  prompt: string;
  source: ImageSource;
  attribution?: UnsplashAttribution;
}

/**
 * Thrown when no image provider (Unsplash or OpenAI) is configured.
 * Callers should catch and emit a `tool_failed` cue with a clear
 * "image generation not configured" message instead of hanging the
 * realtime turn forever.
 */
export class ImageProviderNotConfiguredError extends Error {
  constructor(message = "Image generation not configured") {
    super(message);
    this.name = "ImageProviderNotConfiguredError";
  }
}

// Uses raw OpenAI client rather than getProviderModel() because the Vercel AI SDK
// does not expose image generation — only chat/text completions.

/**
 * Copy the exact bytes of a Node Buffer into a standalone ArrayBuffer.
 * Node Buffers are views over a shared, often larger, pooled ArrayBuffer,
 * so we slice to the buffer's own range before handing it to R2's `put`.
 */
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function resolveImageSize(
  aspectRatio?: string,
): "1024x1024" | "1536x1024" | "1024x1536" {
  if (aspectRatio === "1:1") return "1024x1024";
  return "1536x1024"; // default landscape (16:9 and 4:3 both map to landscape)
}

async function buildImagePrompt(
  client: OpenAI,
  opts: GenerateImageOptions,
): Promise<string> {
  const userContent = [
    `Title: ${opts.title}`,
    opts.excerpt ? `Excerpt: ${opts.excerpt.slice(0, 400)}` : null,
    opts.category ? `Category: ${opts.category}` : null,
    opts.imageStyle ? `Style: ${opts.imageStyle}` : null,
    opts.imageColorScheme ? `Color scheme: ${opts.imageColorScheme}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await client.chat.completions.create(
      {
        model: PROMPT_MODEL,
        max_completion_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      },
      { signal: controller.signal },
    );
    return response.choices[0]?.message?.content?.trim() || opts.title;
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns only the GPT-written prompt string — no image generation, no storage. */
export async function generateImagePrompt(
  opts: Pick<GenerateImageOptions, "title" | "excerpt" | "category" | "imageStyle" | "imageColorScheme">,
): Promise<string> {
  const apiKey = await getProviderApiKey("gpt");
  const client = new OpenAI({ apiKey });
  return buildImagePrompt(client, opts);
}

/**
 * Fetch an Unsplash photo, mirror it into the R2 media bucket (so the
 * URL survives Unsplash CDN changes and stays under our CSP), and
 * return the served media URL plus attribution metadata.
 */
async function fetchUnsplashImage(
  query: string,
  opts: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const photo = await searchUnsplash(query);

  const fallback: GenerateImageResult = {
    url: photo.url,
    alt: photo.alt || opts.title,
    prompt: query,
    source: "unsplash",
    attribution: photo.attribution,
  };

  // Mirror the photo into R2 so the final URL stays stable, matches our
  // CSP, and survives Unsplash CDN changes. We still hand the credit
  // string back to the canvas so the editor can render the Unsplash
  // attribution block. On any storage failure (e.g. the bucket binding
  // is unconfigured) we soft-fall-back to the raw Unsplash CDN URL —
  // it's already CSP-allowed (see security-headers.ts) so it still
  // renders; we just lose the storage mirroring.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let buffer: Buffer;
  try {
    const res = await fetch(photo.url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `Failed to download Unsplash photo: ${res.status} ${res.statusText}`,
      );
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }

  const prefix = opts.storagePrefix ?? "inline";
  const key = `media/unsplash/${randomUUID()}-${prefix}.jpg`;
  try {
    await getMediaBucket().put(key, bufferToArrayBuffer(buffer), {
      httpMetadata: { contentType: "image/jpeg" },
    });
  } catch (err: unknown) {
    log.warn("Media bucket unavailable — returning raw Unsplash URL", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }

  return {
    url: `/api/v1/media/file/${key}`,
    alt: photo.alt || opts.title,
    prompt: query,
    source: "unsplash",
    attribution: photo.attribution,
  };
}

export async function generateImage(
  opts: GenerateImageOptions,
): Promise<GenerateImageResult> {
  // Route to Unsplash first when requested. Unsplash is free + low
  // latency so it's the preferred path for stock-realistic imagery.
  // If the access key is missing we fall back to AI generation so a
  // partial configuration still produces an image.
  if (opts.source === "unsplash" && opts.query?.trim()) {
    try {
      return await fetchUnsplashImage(opts.query.trim(), opts);
    } catch (err: unknown) {
      if (err instanceof UnsplashNotConfiguredError) {
        log.warn("Unsplash not configured — falling back to AI generation");
      } else {
        log.warn("Unsplash lookup failed — falling back to AI generation", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Fall through to AI branch below.
    }
  }

  let apiKey: string;
  try {
    apiKey = await getProviderApiKey("gpt");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ImageProviderNotConfiguredError(
      `Image generation not configured: ${message}`,
    );
  }
  const client = new OpenAI({ apiKey });

  const prompt = opts.customPrompt?.trim()
    ? opts.customPrompt.trim()
    : await buildImagePrompt(client, opts);
  log.info("Generated image prompt", { prompt: prompt.slice(0, 100) });

  const size = resolveImageSize(opts.imageAspectRatio);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let imageResponse: Awaited<ReturnType<typeof client.images.generate>>;
  try {
    imageResponse = await client.images.generate(
      {
        model: IMAGE_MODEL,
        prompt,
        size,
        quality: IMAGE_QUALITY,
        n: 1,
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");
  const buffer = Buffer.from(b64, "base64");

  const prefix = opts.storagePrefix ?? "inline";
  const key = `media/ai-generated/${randomUUID()}-${prefix}.png`;

  await getMediaBucket().put(key, bufferToArrayBuffer(buffer), {
    httpMetadata: { contentType: "image/png" },
  });

  const url = `/api/v1/media/file/${key}`;
  const alt =
    opts.purpose === "inline"
      ? prompt.slice(0, 120)
      : `Featured image for: ${opts.title}`;

  return { url, alt, prompt, source: "ai" };
}
