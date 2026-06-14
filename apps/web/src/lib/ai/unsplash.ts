import "server-only";

import { getBlogConfig } from "@/lib/blog-config";
import { createLogger } from "@/lib/logger";

const log = createLogger("unsplash");

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const UNSPLASH_TIMEOUT_MS = 10_000;

export interface UnsplashAttribution {
  source: "unsplash";
  name: string;
  url: string;
  photoUrl: string;
}

export interface UnsplashSearchResult {
  url: string;
  alt: string;
  attribution: UnsplashAttribution;
}

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: { regular?: string; full?: string; small?: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
}

/**
 * In-process LRU cache to avoid repeat API hits for the same query.
 * Unsplash search responses are stable enough that a 5-minute TTL is
 * plenty for back-to-back tool calls within a single interview.
 */
const CACHE_MAX = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { result: UnsplashSearchResult; expiresAt: number }>();

function readCache(query: string): UnsplashSearchResult | null {
  const entry = cache.get(query);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(query);
    return null;
  }
  return entry.result;
}

function writeCache(query: string, result: UnsplashSearchResult): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(query, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Resolve the Unsplash access key. Checks the UNSPLASH_ACCESS_KEY env
 * var first (local dev / CI) and falls back to Firestore blog config
 * (set via Settings > AI Providers).
 */
async function resolveAccessKey(): Promise<string | null> {
  const envKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (envKey) return envKey;
  try {
    const config = await getBlogConfig();
    const key = config.images?.unsplash?.apiKey?.trim();
    return key && key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

export class UnsplashNotConfiguredError extends Error {
  constructor() {
    super("Unsplash access key not configured");
    this.name = "UnsplashNotConfiguredError";
  }
}

/**
 * Search Unsplash and return the top photo for a query. Throws
 * `UnsplashNotConfiguredError` when no access key is available so the
 * caller can soft-fail with a clear narration message instead of
 * hanging the interview turn.
 */
export async function searchUnsplash(
  query: string,
): Promise<UnsplashSearchResult> {
  const normalized = query.trim().toLowerCase();
  const cached = readCache(normalized);
  if (cached) {
    log.info("Unsplash cache hit", { query: normalized });
    return cached;
  }

  const accessKey = await resolveAccessKey();
  if (!accessKey) throw new UnsplashNotConfiguredError();

  const url = `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(
    query,
  )}&per_page=1&orientation=landscape&content_filter=high`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UNSPLASH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(
        `Unsplash search failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
      ) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as UnsplashSearchResponse;
    const photo = data.results?.[0];
    if (!photo) {
      throw new Error(`No Unsplash results for query "${query}"`);
    }
    const photoUrl = photo.urls.regular ?? photo.urls.full ?? photo.urls.small;
    if (!photoUrl) {
      throw new Error("Unsplash result missing photo URL");
    }
    const alt =
      photo.alt_description?.trim() ||
      photo.description?.trim() ||
      query.trim();
    const result: UnsplashSearchResult = {
      url: photoUrl,
      alt,
      attribution: {
        source: "unsplash",
        name: photo.user.name,
        url: photo.user.links.html,
        photoUrl: photo.links.html,
      },
    };
    writeCache(normalized, result);
    log.info("Unsplash search resolved", {
      query: normalized,
      photoId: photo.id,
      authorName: photo.user.name,
    });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/** Reset cache — test-only. */
export function _resetUnsplashCacheForTests(): void {
  cache.clear();
}
