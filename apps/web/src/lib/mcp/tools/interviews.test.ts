import { describe, expect, it, vi, beforeEach } from "vitest";
import { startInterview } from "./interviews";

const mockCreateShareLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/share-links-repository", () => ({
  createShareLink: mockCreateShareLink,
}));

const SCOPE = { blogId: "default", ownerId: "owner-1" };

describe("startInterview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateShareLink.mockImplementation(
      (_blogId: string, input: Record<string, unknown>) =>
        Promise.resolve({
          id: "share-link-abc123",
          blogId: "default",
          type: input.type,
          createdBy: input.createdBy,
          workspaceId: input.workspaceId ?? "default",
          topic: input.topic ?? null,
          goal: input.goal ?? null,
          style: input.style ?? "smart",
          authMode: input.authMode ?? "anonymous",
          recordingConfig: input.recordingConfig ?? "transcript",
          maxDurationSec: input.maxDurationSec ?? 300,
          expiresAt: null,
          maxUses: null,
          uses: 0,
          status: "active",
          tokenHash: input.tokenHash,
          language: "en",
          scheduledAt: null,
          scheduledGuestEmail: null,
          mode: "live",
          asyncQuestions: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
    );
  });

  it("mints a share link and returns plaintext token + joinUrl ONCE", async () => {
    const result = await startInterview(
      {
        topic: "Test topic",
        type: "link",
        style: "smart",
        authMode: "anonymous",
        recordingConfig: "transcript",
        maxDurationSec: 300,
      },
      SCOPE,
    );
    expect(result.shareLinkId).toBe("share-link-abc123");
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(30);
    expect(result.joinUrl).toContain(`/i/${result.token}`);
    expect(result.note).toMatch(/shown ONCE/);
  });

  it("persists tokenHash (not plaintext) + correct lifecycle defaults", async () => {
    const result = await startInterview(
      {
        type: "private",
        style: "eeat",
        authMode: "email",
        recordingConfig: "audio",
        maxDurationSec: 600,
      },
      { blogId: "blog-B", ownerId: "owner-7" },
    );
    expect(mockCreateShareLink).toHaveBeenCalledOnce();
    const [blogId, persisted] = mockCreateShareLink.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    // The share link is created on the KEY's blog, owned by the key's owner —
    // never the hardcoded default tenant.
    expect(blogId).toBe("blog-B");
    expect(persisted.tokenHash).toBeDefined();
    expect(persisted.tokenHash).not.toBe(result.token);
    expect(persisted.workspaceId).toBe("blog-B");
    expect(persisted.createdBy).toBe("owner-7");
    expect(persisted.type).toBe("private");
    expect(persisted.recordingConfig).toBe("audio");
    expect(persisted.maxDurationSec).toBe(600);
  });
});
