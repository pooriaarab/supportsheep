import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites markdown suffix URLs to the nested route handler", () => {
    const response = middleware(
      new NextRequest("http://localhost:3000/ideas-for-personal-websites.md"),
    );

    expect(response?.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/ideas-for-personal-websites/md",
    );
  });

  it("rewrites index.md to the homepage markdown renderer", () => {
    const response = middleware(
      new NextRequest("http://localhost:3000/index.md"),
    );

    expect(response?.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/api/markdown?pathname=%2F",
    );
  });

  it("rewrites llms suffix URLs to the nested route handler", () => {
    const response = middleware(
      new NextRequest(
        "http://localhost:3000/ideas-for-personal-websites.llms.txt",
      ),
    );

    expect(response?.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/ideas-for-personal-websites/llms.txt",
    );
  });

  it("keeps public article slugs that start with protected prefixes public", () => {
    const seoResponse = middleware(
      new NextRequest("http://localhost:3000/seo-for-real-estate-agents"),
    );
    const searchResponse = middleware(
      new NextRequest("http://localhost:3000/search-engine-marketing-basics"),
    );

    expect(seoResponse?.headers.get("location")).toBeNull();
    expect(searchResponse?.headers.get("location")).toBeNull();
  });

  it("still redirects exact protected dashboard routes without a session", () => {
    const response = middleware(new NextRequest("http://localhost:3000/seo"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fseo",
    );
  });

  it("redirects unauthenticated visitors of /dashboard/interview to /login without surfacing a 404", () => {
    const response = middleware(
      new NextRequest("http://localhost:3000/dashboard/interview"),
    );

    // The wire-level response MUST be a 307 to /login. The page itself
    // (`(dashboard)/dashboard/interview/page.tsx`) only runs for authed
    // visitors and redirects to `/interview/links` — but it must never
    // be reached by unauth users, because that's what produced the
    // hydrated 404 surface in W7.6 Bug 6.1.
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fdashboard%2Finterview",
    );
  });

  it("allows public API prefixes without a session", () => {
    const articlesResponse = middleware(
      new NextRequest("http://localhost:3000/api/v1/public/articles"),
    );
    const freeToolResponse = middleware(
      new NextRequest(
        "http://localhost:3000/api/v1/free-tools/public/word-counter/run",
      ),
    );

    expect(articlesResponse?.headers.get("location")).toBeNull();
    expect(freeToolResponse?.headers.get("location")).toBeNull();
  });

  it("keeps the auth gate ON when DEMO_MODE is unset (protected route redirects)", () => {
    // DEMO_MODE is not stubbed in beforeEach, so it is unset here.
    const response = middleware(new NextRequest("http://localhost:3000/seo"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fseo",
    );
  });

  it("keeps the auth gate ON when DEMO_MODE is explicitly false", () => {
    vi.stubEnv("DEMO_MODE", "false");
    const response = middleware(new NextRequest("http://localhost:3000/seo"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fseo",
    );
  });

  it("bypasses the auth gate only when DEMO_MODE === 'true'", () => {
    vi.stubEnv("DEMO_MODE", "true");
    const response = middleware(new NextRequest("http://localhost:3000/seo"));
    expect(response?.status).not.toBe(307);
    expect(response?.headers.get("location")).toBeNull();
  });

  it("keeps the auth gate ON even when NEXT_PUBLIC_FIREBASE_API_KEY is absent", () => {
    // Production has no Firebase key, but that must not disable the gate.
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    const response = middleware(new NextRequest("http://localhost:3000/seo"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fseo",
    );
  });

  it("allows anonymous POST to /api/v1/client-logs (no redirect to /login)", () => {
    // Browsers ship log batches from any page, including pre-auth surfaces
    // like /login itself, so the middleware MUST NOT redirect this route to
    // /login. The endpoint self-protects via per-IP rate limiting, PII
    // redaction, and a per-batch entry cap (see route.ts).
    const response = middleware(
      new NextRequest("http://localhost:3000/api/v1/client-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entries: [{ level: "info", context: "ui:test", message: "hi" }],
        }),
      }),
    );

    // No redirect, no 405 — middleware passes the request straight through
    // to the route handler, which is the contract the client batcher relies
    // on for both `fetch` (keepalive) and `navigator.sendBeacon`.
    expect(response?.status).not.toBe(307);
    expect(response?.headers.get("location")).toBeNull();
  });
});
