import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    // Mirror Next.js's `redirect()` behaviour: it never returns — it throws a
    // tagged error that Next intercepts at the route boundary.
    const error = new Error(`NEXT_REDIRECT;${path}`);
    (error as { digest?: string }).digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw error;
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("/(dashboard)/dashboard/interview page", () => {
  it("redirects authenticated visitors to /interview/links and never renders a 404", async () => {
    const { default: DashboardInterviewRedirectPage } = await import("../page");

    expect(() => DashboardInterviewRedirectPage()).toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/interview/links");
  });
});
