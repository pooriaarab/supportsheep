import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewPage from "./page";

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockGetArticleById = vi.hoisted(() => vi.fn());
const mockGetMembershipByUser = vi.hoisted(() => vi.fn());
const mockVerifySessionCached = vi.hoisted(() => vi.fn());
const mockCookiesGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

vi.mock("@/lib/articles/repository", () => ({
  getArticleById: mockGetArticleById,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  getMembershipByUser: mockGetMembershipByUser,
  DEFAULT_blog_id: "default",
}));

vi.mock("@/lib/auth/session", () => ({
  verifySessionCached: mockVerifySessionCached,
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({
    get: mockCookiesGet,
  }),
}));

vi.mock("@/components/interview/review/review-admin", () => ({
  ReviewAdmin: () => <div data-testid="review-admin">Review Admin UI</div>,
}));

vi.mock("@/components/interview/review/review-author", () => ({
  ReviewAuthor: () => <div data-testid="review-author">Review Author UI</div>,
}));

vi.mock("@/components/interview/review/review-guest", () => ({
  ReviewGuest: ({ _interview, article }: { _interview: unknown; article: unknown }) => (
    <div data-testid="review-guest" data-interview={JSON.stringify(_interview)} data-article={JSON.stringify(article)}>
      Review Guest UI
    </div>
  ),
}));

vi.mock("@/components/interview/review/review-error", () => ({
  ReviewError: ({ reason }: { reason: string }) => <div data-testid="review-error">Review Error UI: {reason}</div>,
}));

describe("ReviewPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render ReviewError if interview does not exist", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session-token" });
    mockVerifySessionCached.mockResolvedValue({ uid: "user-123", email: "test@test.com" });
    mockGetInterview.mockResolvedValue(null);

    const result = await ReviewPage({ params: Promise.resolve({ id: "missing-id" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Error UI: not_found");
  });

  it("should render pending empty-state when interview has no articleId yet", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session-token" });
    mockVerifySessionCached.mockResolvedValue({ uid: "user-123", email: "test@test.com" });
    mockGetInterview.mockResolvedValue({ status: "ended" });

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Error UI: pending");
  });

  it("should render ReviewError if the referenced article cannot be loaded", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session-token" });
    mockVerifySessionCached.mockResolvedValue({ uid: "user-123", email: "test@test.com" });
    mockGetInterview.mockResolvedValue({ status: "ended", articleId: "art-missing" });
    mockGetArticleById.mockResolvedValue(null);

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Error UI: article_missing");
  });

  it("should render ReviewAdmin if the session user is an admin", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session-token" });
    mockVerifySessionCached.mockResolvedValue({ uid: "admin-123", email: "admin@test.com" });
    mockGetMembershipByUser.mockResolvedValue({ blogId: "default", role: "admin" });
    mockGetInterview.mockResolvedValue({ status: "ended", articleId: "art-123", startedByUid: "author-123" });
    mockGetArticleById.mockResolvedValue({ id: "art-123", title: "Test Article" });

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Admin UI");
  });

  it("should render ReviewAuthor if the session user is the author (and not an admin)", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session-token" });
    mockVerifySessionCached.mockResolvedValue({ uid: "author-123", email: "author@test.com" });
    mockGetMembershipByUser.mockResolvedValue({ blogId: "default", role: "viewer" });
    mockGetInterview.mockResolvedValue({ status: "ended", articleId: "art-123", startedByUid: "author-123" });
    mockGetArticleById.mockResolvedValue({ id: "art-123", title: "Test Article" });

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Author UI");
  });

  it("should render ReviewGuest if there is no session", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    mockVerifySessionCached.mockResolvedValue(null);
    mockGetInterview.mockResolvedValue({ status: "ended", articleId: "art-123", startedByUid: "author-123" });
    mockGetArticleById.mockResolvedValue({ id: "art-123", title: "Test Article" });

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Guest UI");
  });

  it("should render the error UI when Firestore throws on the interview lookup", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    mockVerifySessionCached.mockResolvedValue(null);
    mockGetInterview.mockRejectedValue(new Error("d1 unavailable"));

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-boom" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Error UI: error");
  });

  it("should render the error UI when Firestore throws on the article lookup", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    mockVerifySessionCached.mockResolvedValue(null);
    mockGetInterview.mockResolvedValue({ status: "ended", articleId: "art-123", startedByUid: "author-123" });
    mockGetArticleById.mockRejectedValue(new Error("d1 unavailable"));

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-boom" }) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Error UI: error");
  });

  it("should coerce non-serializable date fields on the interview and article into ISO strings before passing them to client components", async () => {
    // Regression for W17.3: raw Firestore Timestamps cannot cross the RSC
    // boundary into a "use client" component — the serializer throws
    // *after* the page function returns, so the page's try/catch cannot
    // recover. The page must sweep date-like values to ISO strings first.
    // (Timestamp-specific coverage lives in timestamp-utils.test.ts; this
    // test uses Date so the file does not need to import firebase-admin.)
    const isoString = "2026-01-02T03:04:05.000Z";
    const dateLike = new Date(isoString);

    mockCookiesGet.mockReturnValue(undefined);
    mockVerifySessionCached.mockResolvedValue(null);
    mockGetInterview.mockResolvedValue({
      status: "ended",
      articleId: "art-123",
      startedByUid: "author-123",
      createdAt: dateLike,
      startedAt: dateLike,
      endedAt: dateLike,
      updatedAt: dateLike,
    });
    mockGetArticleById.mockResolvedValue({
      id: "art-123",
      title: "Test Article",
      createdAt: dateLike,
      updatedAt: dateLike,
      publishedAt: dateLike,
    });

    const result = await ReviewPage({ params: Promise.resolve({ id: "int-123" }) });

    // The whole React tree must be serializable — every date field must
    // have been turned into a plain string before reaching the client
    // component's props.
    const json = JSON.stringify(result);
    expect(json).toContain(isoString);

    // And the page still renders the expected view.
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Review Guest UI");
    expect(html).toContain(isoString);
  });
});
