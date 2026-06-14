import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LiveInCallPage from "../page";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";

const VALID_TOKEN = "a".repeat(43);
const VALID_TOKEN_HASH = hashShareLinkToken(VALID_TOKEN);

// D1 repository mocks
const mockGetInterview = vi.fn();
const mockGetShareLink = vi.fn();
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: () => mockGetInterview(),
}));
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: () => mockGetShareLink(),
}));

// Mock child components
vi.mock("../components/expired-card", () => ({
  ExpiredCard: () => <div data-testid="expired-card">Expired or Invalid Link</div>,
}));

vi.mock("@/components/interview/in-call-layout-desktop", () => ({
  InCallLayoutDesktop: (props: { topic?: string; guestName?: string }) => (
    <div data-testid="in-call-layout">
      <h1>Topic: {props.topic}</h1>
      <h2>Speaker: {props.guestName}</h2>
    </div>
  ),
}));

describe("LiveInCallPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ExpiredCard if searchParams are missing", async () => {
    const pageResult = await LiveInCallPage({
      params: Promise.resolve({ token: "token-abc" }),
      searchParams: Promise.resolve({ interview: undefined }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
  });

  it("renders ExpiredCard if interview does not exist in database", async () => {
    mockGetInterview.mockResolvedValueOnce(null);

    const pageResult = await LiveInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-invalid",
        ephemeral: "oai-token",
        itoken: "int-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
  });

  it("renders ExpiredCard if path token does not match the interview's share link", async () => {
    mockGetInterview.mockResolvedValueOnce({
      status: "live",
      shareLinkId: "share-link-123",
      topic: "Should not be visible",
      guestName: "Should not be visible",
      maxDurationSec: 300,
    });
    mockGetShareLink.mockResolvedValueOnce({ tokenHash: "different-hash" });

    const pageResult = await LiveInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        ephemeral: "oai-token",
        itoken: "int-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
    expect(html).not.toContain("Should not be visible");
  });

  it("renders InCallLayoutDesktop when path token matches the interview's share link", async () => {
    mockGetInterview.mockResolvedValueOnce({
      status: "live",
      shareLinkId: "share-link-123",
      topic: "Artificial Intelligence in Medicine",
      guestName: "Dr. Alice",
      maxDurationSec: 300,
    });
    mockGetShareLink.mockResolvedValueOnce({ tokenHash: VALID_TOKEN_HASH });

    const pageResult = await LiveInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        ephemeral: "oai-token",
        itoken: "int-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Artificial Intelligence in Medicine");
    expect(html).toContain("Dr. Alice");
  });
});
