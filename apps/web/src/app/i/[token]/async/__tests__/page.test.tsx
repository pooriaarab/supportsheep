import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AsyncGuestPage from "../page";

const VALID_TOKEN = "a".repeat(43);

// D1 repository mocks
const mockGetInterview = vi.fn();
const mockGetShareLinkByTokenHash = vi.fn();

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: () => mockGetInterview(),
}));
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLinkByTokenHash: () => mockGetShareLinkByTokenHash(),
}));

// Mock the recording-access module so the server component does not pull in
// the server-only auth/repository deps; buildRecordingFileUrl is pure.
vi.mock("@/lib/interviews/recording-access", () => ({
  buildRecordingFileUrl: (interviewId: string, kind: string, questionId: string) =>
    `/api/v1/interviews/${interviewId}/recording-file?kind=${kind}&questionId=${questionId}`,
}));

// Mock child components
vi.mock("../../components/expired-card", () => ({
  ExpiredCard: () => <div data-testid="expired-card">Expired or Invalid Link</div>,
}));

vi.mock("../components/async-interview-client", () => ({
  AsyncInterviewClient: (props: { interviewId: string }) => (
    <div data-testid="async-client">
      Async Interview Client: {props.interviewId}
    </div>
  ),
}));

describe("AsyncGuestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ExpiredCard if searchParams are missing", async () => {
    const pageResult = await AsyncGuestPage({
      params: Promise.resolve({ token: "token-abc" }),
      searchParams: Promise.resolve({ interview: undefined, itoken: undefined }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Expired or Invalid Link");
  });

  it("renders ExpiredCard if share link is not async", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValueOnce({
      id: "share-link-123",
      status: "active",
      mode: "live", // Not async!
    });

    const pageResult = await AsyncGuestPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        itoken: "mock-itoken",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Expired or Invalid Link");
  });

  it("renders ExpiredCard if interview does not exist", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValueOnce({
      id: "share-link-123",
      status: "active",
      mode: "async",
    });
    mockGetInterview.mockResolvedValueOnce(null);

    const pageResult = await AsyncGuestPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-invalid",
        itoken: "mock-itoken",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Expired or Invalid Link");
  });

  it("renders ExpiredCard if interview properties don't match the share link", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValueOnce({
      id: "share-link-123",
      status: "active",
      mode: "async",
    });
    mockGetInterview.mockResolvedValueOnce({
      status: "live",
      shareLinkId: "different-share-link-id", // mismatch!
      mode: "async",
    });

    const pageResult = await AsyncGuestPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        itoken: "mock-itoken",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Expired or Invalid Link");
  });

  it("renders AsyncInterviewClient if share link and interview are valid and match", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValueOnce({
      id: "share-link-123",
      status: "active",
      mode: "async",
      asyncQuestions: [
        { id: "q1", text: "Q1", audioStoragePath: "path/to/audio" },
      ],
    });
    mockGetInterview.mockResolvedValueOnce({
      status: "live",
      shareLinkId: "share-link-123",
      mode: "async",
    });

    const pageResult = await AsyncGuestPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        itoken: "mock-itoken",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Async Interview Client: int-123");
  });
});
