import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LiveVideoInCallPage from "../page";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import React from "react";

const VALID_TOKEN = "a".repeat(43);
const VALID_TOKEN_HASH = hashShareLinkToken(VALID_TOKEN);
const VALID_TAVUS_URL = "https://tavusapi.com/v2/conversations/abc";

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
vi.mock("../../components/expired-card", () => ({
  ExpiredCard: () => <div data-testid="expired-card">Invite no longer available</div>,
}));

vi.mock("@/components/interview/in-call-layout-desktop", () => ({
  InCallLayoutDesktop: (props: { topic?: string; guestName?: string; tavusUrl?: string }) => (
    <div data-testid="in-call-layout">
      <h1>Topic: {props.topic}</h1>
      <h2>Speaker: {props.guestName}</h2>
      <p>TavusUrl: {props.tavusUrl}</p>
    </div>
  ),
}));

describe("LiveVideoInCallPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ExpiredCard if searchParams are missing", async () => {
    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: "token-abc" }),
      searchParams: Promise.resolve({ interview: undefined }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
  });

  it("renders ExpiredCard if ephemeral token is missing", async () => {
    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        tavusUrl: VALID_TAVUS_URL,
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
  });

  it("renders ExpiredCard if interview does not exist in database", async () => {
    mockGetInterview.mockResolvedValueOnce(null);

    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-invalid",
        tavusUrl: VALID_TAVUS_URL,
        ephemeral: "oai-token",
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

    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        tavusUrl: VALID_TAVUS_URL,
        ephemeral: "oai-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
    expect(html).not.toContain("Should not be visible");
  });

  it("renders ExpiredCard if tavusUrl points to a non-Tavus domain", async () => {
    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        tavusUrl: "https://attacker.example.com/phishing",
        ephemeral: "oai-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
    expect(html).not.toContain("iframe");
  });

  it("renders ExpiredCard if tavusUrl uses http instead of https", async () => {
    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        tavusUrl: "http://tavusapi.com/v2/conversations/abc",
        ephemeral: "oai-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("Invite no longer available");
  });

  it("renders InCallLayoutDesktop with tavusUrl when the share-link token matches", async () => {
    mockGetInterview.mockResolvedValueOnce({
      status: "live",
      shareLinkId: "share-link-123",
      topic: "SaaS Video Strategy",
      guestName: "Guest",
      maxDurationSec: 300,
    });
    mockGetShareLink.mockResolvedValueOnce({ tokenHash: VALID_TOKEN_HASH });

    const pageResult = await LiveVideoInCallPage({
      params: Promise.resolve({ token: VALID_TOKEN }),
      searchParams: Promise.resolve({
        interview: "int-123",
        tavusUrl: VALID_TAVUS_URL,
        ephemeral: "oai-token",
      }),
    });

    const html = renderToStaticMarkup(pageResult);
    expect(html).toContain("SaaS Video Strategy");
    expect(html).toContain("Guest");
    expect(html).toContain(VALID_TAVUS_URL);
    // The new flow renders the custom Daily-SDK surface via InCallLayoutDesktop
    // — no embedded iframe, no Daily prebuilt chrome.
    expect(html).not.toContain("<iframe");
  });
});
