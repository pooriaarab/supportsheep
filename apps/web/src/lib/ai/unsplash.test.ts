import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetBlogConfig = vi.hoisted(() => vi.fn());

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
}));

import {
  searchUnsplash,
  UnsplashNotConfiguredError,
  _resetUnsplashCacheForTests,
} from "./unsplash";

describe("unsplash", () => {
  beforeEach(() => {
    _resetUnsplashCacheForTests();
    vi.resetAllMocks();
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  afterEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  it("throws UnsplashNotConfiguredError when no key is set in env or config", async () => {
    mockGetBlogConfig.mockResolvedValue({ images: {} });
    await expect(searchUnsplash("mountains")).rejects.toBeInstanceOf(
      UnsplashNotConfiguredError,
    );
  });

  it("reads the access key from the env var", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "env-key";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "abc",
            alt_description: "a misty mountain",
            description: null,
            urls: { regular: "https://images.unsplash.com/photo-1" },
            links: { html: "https://unsplash.com/photos/abc" },
            user: {
              name: "Jane Doe",
              links: { html: "https://unsplash.com/@janedoe" },
            },
          },
        ],
      }),
    } as unknown as Response);

    const result = await searchUnsplash("misty mountains");
    expect(result.url).toBe("https://images.unsplash.com/photo-1");
    expect(result.alt).toBe("a misty mountain");
    expect(result.attribution.source).toBe("unsplash");
    expect(result.attribution.name).toBe("Jane Doe");
    expect(result.attribution.url).toBe("https://unsplash.com/@janedoe");
    expect(result.attribution.photoUrl).toBe("https://unsplash.com/photos/abc");

    const headers = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Client-ID env-key");
  });

  it("reads the access key from Firestore blog config as a fallback", async () => {
    mockGetBlogConfig.mockResolvedValue({
      images: { unsplash: { apiKey: "firestore-key" } },
    });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "xyz",
            alt_description: null,
            description: "city",
            urls: { regular: "https://images.unsplash.com/photo-2" },
            links: { html: "https://unsplash.com/photos/xyz" },
            user: { name: "John", links: { html: "https://unsplash.com/@john" } },
          },
        ],
      }),
    } as unknown as Response);

    const result = await searchUnsplash("city skyline");
    expect(result.url).toBe("https://images.unsplash.com/photo-2");
    expect(result.alt).toBe("city");
  });

  it("caches results within the TTL", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "k";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "a",
            alt_description: "a",
            description: null,
            urls: { regular: "https://images.unsplash.com/a" },
            links: { html: "https://unsplash.com/photos/a" },
            user: { name: "n", links: { html: "https://unsplash.com/@n" } },
          },
        ],
      }),
    } as unknown as Response);

    await searchUnsplash("forest");
    await searchUnsplash("forest");
    await searchUnsplash("FOREST"); // case-insensitive cache hit
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws on no results", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "k";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);
    await expect(searchUnsplash("zzzz")).rejects.toThrow(/No Unsplash results/);
  });

  it("throws on non-200 response", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "k";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "bad key",
    } as unknown as Response);
    await expect(searchUnsplash("anything")).rejects.toThrow(
      /Unsplash search failed: 401/,
    );
  });
});
