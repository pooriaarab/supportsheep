import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mintTavusSession, TavusMintError } from "./tavus";

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: vi.fn(async () => ({
    ai: {
      providers: {
        tavus: { apiKey: "", defaultAvatarId: "", defaultPersonaId: "" },
      },
    },
  })),
}));

import { getBlogConfig } from "@/lib/blog-config";

describe("tavus-session-minting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(getBlogConfig).mockResolvedValue({
      ai: {
        providers: {
          tavus: { apiKey: "", defaultAvatarId: "", defaultPersonaId: "" },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw a TavusMintError with kind missing_api_key when no key is configured", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "",
            defaultAvatarId: "avatar-123",
            defaultPersonaId: "persona-123",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    await expect(
      mintTavusSession({ topic: "Test Topic", maxDurationSec: 300 }),
    ).rejects.toMatchObject({
      name: "TavusMintError",
      kind: "missing_api_key",
    });
  });

  it("should throw a TavusMintError with kind missing_replica when no avatar is configured", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "",
            defaultPersonaId: "persona-123",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    await expect(
      mintTavusSession({ topic: "Test Topic", maxDurationSec: 300 }),
    ).rejects.toMatchObject({
      name: "TavusMintError",
      kind: "missing_replica",
    });
  });

  it("should throw missing_replica when persona is not configured (required by Tavus v2)", async () => {
    // Tavus v2 Create Conversation REQUIRES persona_id. Previously we
    // omitted it entirely and the upstream API rejected the request,
    // which the consent route then surfaced as a generic 502 "Failed to
    // initialize video session" — the exact bug we are fixing.
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "avatar-123",
            defaultPersonaId: "",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    await expect(
      mintTavusSession({ topic: "Test Topic", maxDurationSec: 300 }),
    ).rejects.toMatchObject({
      name: "TavusMintError",
      kind: "missing_replica",
    });
  });

  it("should include persona_id in the request body sent to Tavus", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key-config",
            defaultAvatarId: "default-avatar-config",
            defaultPersonaId: "default-persona-config",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        conversation_id: "tavus-conv-abc",
        conversation_url: "https://tavusapi.com/v2/conversations/abc",
      }),
    } as unknown as Response);

    await mintTavusSession({
      topic: "Interview Topic",
      maxDurationSec: 600,
    });

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://tavusapi.com/v2/conversations");
    const body = JSON.parse(call[1]?.body as string);
    expect(body.replica_id).toBe("default-avatar-config");
    expect(body.persona_id).toBe("default-persona-config");
    expect(body.conversation_name).toBe("Interview Topic");
    expect(body.properties.max_call_duration).toBe(600);
  });

  it("should allow input overrides for avatarId and personaId", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "default-avatar",
            defaultPersonaId: "default-persona",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        conversation_id: "conv-123",
        conversation_url: "https://tavus.com/c/123",
      }),
    } as unknown as Response);

    const session = await mintTavusSession({
      topic: "Custom Topic",
      maxDurationSec: 300,
      avatarId: "custom-avatar",
      personaId: "custom-persona",
    });

    expect(session.conversationId).toBe("conv-123");
    expect(session.conversationUrl).toBe("https://tavus.com/c/123");

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.replica_id).toBe("custom-avatar");
    expect(body.persona_id).toBe("custom-persona");
  });

  it("should throw TavusMintError with kind upstream_error and status on non-2xx", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "default-avatar",
            defaultPersonaId: "default-persona",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => "req_abc" },
      text: async () => "Unauthorized API Key",
    } as unknown as Response);

    await expect(
      mintTavusSession({ topic: "Topic", maxDurationSec: 300 }),
    ).rejects.toMatchObject({
      name: "TavusMintError",
      kind: "upstream_error",
      status: 401,
      requestId: "req_abc",
    });
  });

  it("should throw malformed_response when Tavus returns 200 without conversation_id", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "default-avatar",
            defaultPersonaId: "default-persona",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ status: "active" }),
    } as unknown as Response);

    await expect(
      mintTavusSession({ topic: "Topic", maxDurationSec: 300 }),
    ).rejects.toMatchObject({
      name: "TavusMintError",
      kind: "malformed_response",
    });
  });

  it("should classify network errors as upstream_error", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "tavus-key",
            defaultAvatarId: "default-avatar",
            defaultPersonaId: "default-persona",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    vi.spyOn(global, "fetch").mockRejectedValue(
      new Error("ECONNRESET socket hang up"),
    );

    await expect(
      mintTavusSession({ topic: "Topic", maxDurationSec: 300 }),
    ).rejects.toBeInstanceOf(TavusMintError);
  });

  it("should never include the raw API key in the request body or error", async () => {
    vi.mocked(getBlogConfig).mockResolvedValueOnce({
      ai: {
        providers: {
          tavus: {
            apiKey: "secret-key-do-not-log",
            defaultAvatarId: "avatar",
            defaultPersonaId: "persona",
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof getBlogConfig>>);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => "boom",
    } as unknown as Response);

    let caught: TavusMintError | null = null;
    try {
      await mintTavusSession({ topic: "T", maxDurationSec: 300 });
    } catch (e) {
      caught = e as TavusMintError;
    }

    // Header carries the key but the request body must not.
    const body = fetchSpy.mock.calls[0][1]?.body as string;
    expect(body).not.toContain("secret-key-do-not-log");
    expect(caught?.message ?? "").not.toContain("secret-key-do-not-log");
    expect(caught?.responseBody ?? "").not.toContain("secret-key-do-not-log");
  });
});
