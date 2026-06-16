import type { FreeTool } from "@repo/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

class MockDuplicateFreeToolSlugError extends Error {
  constructor(slug: string) {
    super(`Free tool slug already exists: ${slug}`);
    this.name = "DuplicateFreeToolSlugError";
  }
}

const mockPatchFreeTool = vi.fn();
const mockGetFreeToolById = vi.fn();
const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockGetProviderModel = vi.fn();
const mockGenerateText = vi.fn();

const repositoryMocks = ((
  globalThis as typeof globalThis & {
    __freeToolsRepositoryMocks?: {
      listFreeTools: ReturnType<typeof vi.fn>;
      seedDefaultFreeTools: ReturnType<typeof vi.fn>;
      patchFreeTool: typeof mockPatchFreeTool;
      getFreeToolById: typeof mockGetFreeToolById;
      resolvePublicFreeToolBySlug: ReturnType<typeof vi.fn>;
      DuplicateFreeToolSlugError: typeof MockDuplicateFreeToolSlugError;
    };
  }
).__freeToolsRepositoryMocks ??= {
  listFreeTools: vi.fn(),
  seedDefaultFreeTools: vi.fn(),
  patchFreeTool: mockPatchFreeTool,
  getFreeToolById: mockGetFreeToolById,
  resolvePublicFreeToolBySlug: vi.fn(),
  DuplicateFreeToolSlugError: MockDuplicateFreeToolSlugError,
});

vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status = 401,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/free-tools/repository", () => ({
  DuplicateFreeToolSlugError: repositoryMocks.DuplicateFreeToolSlugError,
  listFreeTools: repositoryMocks.listFreeTools,
  patchFreeTool: repositoryMocks.patchFreeTool,
  getFreeToolById: repositoryMocks.getFreeToolById,
  resolvePublicFreeToolBySlug: repositoryMocks.resolvePublicFreeToolBySlug,
  seedDefaultFreeTools: repositoryMocks.seedDefaultFreeTools,
}));

vi.mock("@/lib/ai/providers", () => ({
  getProviderModel: mockGetProviderModel,
}));

vi.mock("ai", () => ({
  generateText: mockGenerateText,
}));

function fakeTool(overrides: Partial<FreeTool> = {}): FreeTool {
  return {
    id: "word-counter",
    blogId: "default",
    templateId: "word-counter",
    source: "predefined",
    enabled: true,
    slug: "word-counter",
    title: "Word Counter",
    metaTitle: "Word Counter",
    metaDescription: "Count words.",
    intro: "Count words.",
    faq: [],
    cta: { label: "Try Supportsheep", url: "https://supportsheep.com/" },
    callout: {
      enabled: true,
      heading: "Build your site",
      body: "Turn this into a website.",
      primaryLabel: "Try Supportsheep",
      primaryUrl: "https://supportsheep.com/",
      secondaryLabel: "Learn more",
      secondaryUrl: "https://supportsheep.com/",
      utm: {
        source: "supportsheep_blog",
        medium: "free_tool",
        campaign: "{{toolSlug}}",
        content: "bottom_callout",
        term: "",
      },
    },
    appearance: { layout: "utility", accent: "default" },
    ai: {
      enabled: false,
      provider: "claude",
      model: "claude-sonnet-4-6",
      dailyLimit: 10,
      maxInputChars: 12000,
      maxOutputTokens: 1200,
    },
    seo: {
      indexable: true,
      canonicalPath: "/tools/word-counter",
      includeInToolsIndex: true,
      includeInSitemap: true,
    },
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("single free tool admin route", () => {
  beforeEach(() => {
    repositoryMocks.patchFreeTool.mockReset();
    repositoryMocks.getFreeToolById.mockReset();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "admin@example.com",
      authTime: 0,
    });
    mockLogAuditEvent.mockReset();
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockGetProviderModel.mockReset();
    mockGenerateText.mockReset();
  });

  it("fetches one tool by id", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({ id: "word-counter", title: "Word Counter", slug: "word-counter" }),
    );

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/free-tools/word-counter") as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "word-counter",
        title: "Word Counter",
        slug: "word-counter",
      },
    });
  });

  it("returns 404 when the tool is missing", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(null);

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/free-tools/missing") as never,
      { params: Promise.resolve({ id: "missing" }) } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Free tool not found",
    });
  });

  it("patches supported customization fields", async () => {
    repositoryMocks.patchFreeTool.mockResolvedValue(undefined);
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({ title: "Updated Word Counter" }),
    );

    const route = await import("./route");
    const response = await route.PATCH(
      new Request("http://test.local/api/v1/free-tools/word-counter", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Updated Word Counter" }),
      }) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.patchFreeTool).toHaveBeenCalledWith(
      "word-counter",
      { title: "Updated Word Counter" },
      expect.any(String), // blogId
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "word-counter", title: "Updated Word Counter" },
    });
  });

  it("maps duplicate slugs to 409", async () => {
    repositoryMocks.patchFreeTool.mockRejectedValue(
      new repositoryMocks.DuplicateFreeToolSlugError("taken-slug"),
    );

    const route = await import("./route");
    const response = await route.PATCH(
      new Request("http://test.local/api/v1/free-tools/word-counter", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "taken-slug" }),
      }) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Free tool slug already exists",
    });
  });

  it("rejects non-https public URLs in tool updates", async () => {
    const route = await import("./route");
    const response = await route.PATCH(
      new Request("http://test.local/api/v1/free-tools/word-counter", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cta: { label: "Bad", url: "javascript:alert(1)" },
        }),
      }) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(400);
    expect(repositoryMocks.patchFreeTool).not.toHaveBeenCalled();
  });

  it("generates a structured callout draft without saving it", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({
        title: "Word Counter",
        slug: "word-counter",
        intro: "Count words.",
        metaDescription: "Count words and characters.",
        ai: {
          enabled: false,
          provider: "gpt",
          model: "gpt-4.1",
          dailyLimit: 10,
          maxInputChars: 12000,
          maxOutputTokens: 1200,
        },
      }),
    );
    mockGetProviderModel.mockResolvedValue({ modelId: "gpt-4.1" });
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        heading: "Turn word counts into better pages",
        body: "Use Supportsheep to publish the page after checking length.",
        primaryLabel: "Try Supportsheep",
        primaryUrl: "https://supportsheep.com/",
        secondaryLabel: "Learn more",
        secondaryUrl: "https://supportsheep.com/",
      }),
    });

    const route = await import("./generate-callout/route");
    const response = await route.POST(
      new Request(
        "http://test.local/api/v1/free-tools/word-counter/generate-callout",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(200);
    expect(mockGenerateText.mock.calls[0][0].prompt).not.toContain("raw prompt");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        heading: "Turn word counts into better pages",
        primaryUrl: "https://supportsheep.com/",
      },
    });
  });

  it("falls back to existing callout URLs when generated URLs are not https", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({
        ai: {
          enabled: false,
          provider: "gpt",
          model: "gpt-4.1",
          dailyLimit: 10,
          maxInputChars: 12000,
          maxOutputTokens: 1200,
        },
      }),
    );
    mockGetProviderModel.mockResolvedValue({ modelId: "gpt-4.1" });
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        heading: "Turn word counts into better pages",
        body: "Use Supportsheep.",
        primaryLabel: "Try Supportsheep",
        primaryUrl: "javascript:alert(1)",
        secondaryLabel: "Learn more",
        secondaryUrl: "ftp://example.com",
      }),
    });

    const route = await import("./generate-callout/route");
    const response = await route.POST(
      new Request(
        "http://test.local/api/v1/free-tools/word-counter/generate-callout",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        primaryUrl: "https://supportsheep.com/",
        secondaryUrl: "https://supportsheep.com/",
      },
    });
  });

  it("returns a controlled error when callout AI credentials are missing", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({
        ai: {
          enabled: false,
          provider: "claude",
          model: "claude-sonnet-4-6",
          dailyLimit: 10,
          maxInputChars: 12000,
          maxOutputTokens: 1200,
        },
      }),
    );
    mockGetProviderModel.mockRejectedValue(
      new Error("Claude API key not configured"),
    );

    const route = await import("./generate-callout/route");
    const response = await route.POST(
      new Request(
        "http://test.local/api/v1/free-tools/word-counter/generate-callout",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "AI provider is not configured",
    });
  });

  it("returns a controlled error when callout generation rejects an invalid API key", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({
        ai: {
          enabled: false,
          provider: "claude",
          model: "claude-sonnet-4-20250514",
          dailyLimit: 10,
          maxInputChars: 12000,
          maxOutputTokens: 1200,
        },
      }),
    );
    mockGetProviderModel.mockResolvedValue({
      modelId: "claude-sonnet-4-20250514",
    });
    mockGenerateText.mockRejectedValue(new Error("invalid x-api-key"));

    const route = await import("./generate-callout/route");
    const response = await route.POST(
      new Request(
        "http://test.local/api/v1/free-tools/word-counter/generate-callout",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "AI provider is not configured",
    });
  });

  it("returns a controlled error when callout generation returns invalid JSON", async () => {
    repositoryMocks.getFreeToolById.mockResolvedValue(
      fakeTool({
        ai: {
          enabled: false,
          provider: "gpt",
          model: "gpt-4.1",
          dailyLimit: 10,
          maxInputChars: 12000,
          maxOutputTokens: 1200,
        },
      }),
    );
    mockGetProviderModel.mockResolvedValue({ modelId: "gpt-4.1" });
    mockGenerateText.mockResolvedValue({ text: "not json" });

    const route = await import("./generate-callout/route");
    const response = await route.POST(
      new Request(
        "http://test.local/api/v1/free-tools/word-counter/generate-callout",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "word-counter" }) } as never,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "AI callout response was not valid JSON",
    });
  });
});
