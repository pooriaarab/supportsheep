import { test, expect } from "@playwright/test";

/**
 * Regression: the self-flow "/interview/[id]/live" Server Component used to
 * 500 in prod because `cookies().set(...)` was called AFTER the
 * `await mintRealtimeSession(...)`. Next.js App Router rejects cookie
 * mutations once the response has begun streaming. The fix is to mint and
 * set the interview-token cookie BEFORE the realtime mint await. This spec
 * exercises the full author self-flow end-to-end and asserts the live page
 * responds 200 (even when realtime mint fails or returns an error page —
 * what we are guarding against is the 500 from the cookie throw).
 *
 * Flow: POST /api/v1/auth/test-login → POST /api/v1/interviews { self: true }
 *       → GET /interview/{id}/live → assert response.status() === 200.
 */
test.describe("Interview live self-flow (w26 regression)", () => {
  test("GET /interview/{id}/live returns 200 for a fresh self-flow interview", async ({
    request,
  }) => {
    // 1. Login as the test admin to get a session cookie scoped to the request context.
    const loginRes = await request.post("/api/v1/auth/test-login", {
      data: { email: "dev@example.com" },
    });
    expect(loginRes.ok()).toBe(true);

    // 2. Create a self-flow interview. The response shape is { interviewId, status: "consent" }.
    const createRes = await request.post("/api/v1/interviews", {
      data: {
        self: true,
        style: "smart",
        topic: "Live-page 500 regression test",
        maxDurationSec: 300,
        language: "en",
      },
    });
    expect(createRes.ok()).toBe(true);
    const { interviewId } = (await createRes.json()) as { interviewId: string };
    expect(interviewId).toBeTruthy();

    // 3. Hit the live page directly. The Server Component must:
    //    (a) authenticate, (b) authorize, (c) transition status from
    //    consent → live, (d) set the HttpOnly interview-token cookie
    //    BEFORE any further awaits, (e) attempt to mint the OpenAI
    //    realtime session, and (f) render the in-call layout (or an
    //    EmptyState if mint fails — both are 200).
    //
    //    The bug we are guarding against was a hard 500 from
    //    `cookies().set(...)` being called after streaming had begun.
    const liveRes = await request.get(`/interview/${interviewId}/live`, {
      maxRedirects: 0,
    });
    expect(liveRes.status()).toBe(200);

    // The interview-token cookie must be present on the response so the
    // client-side SSE stream + canvas POSTs can authenticate.
    const setCookieHeaders = liveRes.headersArray().filter(
      (h) => h.name.toLowerCase() === "set-cookie",
    );
    const tokenCookie = setCookieHeaders.find((h) =>
      h.value.startsWith(`interview_token_${interviewId}=`),
    );
    expect(
      tokenCookie,
      `Expected set-cookie for interview_token_${interviewId}; got ${JSON.stringify(setCookieHeaders.map((h) => h.value))}`,
    ).toBeTruthy();
    // HttpOnly + correct Path scope are part of the contract — verify both
    // so the cookie reorder doesn't silently regress its security
    // attributes.
    expect(tokenCookie!.value.toLowerCase()).toContain("httponly");
    expect(tokenCookie!.value).toContain(
      `Path=/api/v1/interviews/${interviewId}`,
    );
  });
});
