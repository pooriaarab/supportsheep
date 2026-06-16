import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { POST } from "./route";

const mockGetArticleBySlug = vi.hoisted(() => vi.fn());
const mockUpdateArticleBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/lib/articles/repository", () => ({
  getArticleBySlug: mockGetArticleBySlug,
  updateArticleBySlug: mockUpdateArticleBySlug,
}));

const mockCreateNotification = vi.hoisted(() => vi.fn());

vi.mock("@/lib/notifications/repository", () => ({
  createNotification: mockCreateNotification,
}));

const mockListMemberUserIdsByRoles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  listMemberUserIdsByRoles: mockListMemberUserIdsByRoles,
}));

// Mock createApiHandler to pass blogId and session
vi.mock("@/lib/create-api-handler", () => {
  return {
    createApiHandler: ({ handler }: { handler: (args: { request: NextRequest; params: Record<string, string>; session: { uid: string; role: string }; blogId: string; role: string | null }) => Promise<NextResponse> }) => {
      return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
        const mockSession = { uid: "user-123", role: "user" };
        const params = await ctx.params;
        return handler({ request: req, params, session: mockSession, blogId: "default", role: "user" });
      };
    },
  };
});

describe("POST /api/v1/articles/[id]/submit-for-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMemberUserIdsByRoles.mockResolvedValue([]);
    mockUpdateArticleBySlug.mockResolvedValue({ status: "pending_review" });
    mockCreateNotification.mockResolvedValue({});
  });

  it("should return 404 if article does not exist", async () => {
    mockGetArticleBySlug.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/articles/missing-id/submit-for-review", {
      method: "Article",
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "missing-id" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Article not found");
  });

  it("should return 403 if user is not authorized (not the author and not admin)", async () => {
    mockGetArticleBySlug.mockResolvedValue({
      id: "article-123",
      authorId: "unrelated-user",
      status: "draft",
      title: "Test Article",
      slug: "article-123",
    });

    const req = new NextRequest("http://localhost/api/v1/articles/article-123/submit-for-review", {
      method: "Article",
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "article-123" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("should return 409 conflict if article is already published or pending_review", async () => {
    mockGetArticleBySlug.mockResolvedValue({
      id: "article-123",
      authorId: "user-123",
      status: "published",
      title: "Test Article",
      slug: "article-123",
    });

    const req = new NextRequest("http://localhost/api/v1/articles/article-123/submit-for-review", {
      method: "Article",
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "article-123" }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Cannot submit article that is already published or pending review");
  });

  it("should submit article successfully for author, changing status to pending_review, and send notifications to admins", async () => {
    mockGetArticleBySlug.mockResolvedValue({
      id: "article-123",
      title: "Test Article",
      slug: "test-article",
      authorId: "user-123",
      status: "draft",
      interviewId: "interview-789",
    });

    mockListMemberUserIdsByRoles.mockResolvedValue(["admin-1", "owner-2"]);

    const req = new NextRequest("http://localhost/api/v1/articles/article-123/submit-for-review", {
      method: "Article",
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "article-123" }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify article status updated to pending_review via repository
    expect(mockUpdateArticleBySlug).toHaveBeenCalledWith(
      "default",
      "article-123",
      expect.objectContaining({
        status: "pending_review",
      })
    );

    // Verify notifications were created for both admin and owner via D1 repo
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        userId: "admin-1",
        type: "task",
        title: "New interview draft submitted for review",
        message: 'A new interview draft for "Test Article" has been submitted for review.',
        actionUrl: "/posts/test-article/edit?fromInterview=interview-789",
      })
    );
  });
});
