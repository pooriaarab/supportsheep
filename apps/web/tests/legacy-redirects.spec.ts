import { expect, test } from "@playwright/test";

test.describe("legacy-redirects", () => {
  test("/uncategorized/foo returns 301 to /foo", async ({ request }) => {
    const res = await request.get("/uncategorized/foo", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe(
      "/foo",
    );
  });

  test("/tag/any returns 301 to /", async ({ request }) => {
    const res = await request.get("/tag/any", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe(
      "/",
    );
  });

  test("/website-tips/foo returns 301 to /foo", async ({ request }) => {
    const res = await request.get("/website-tips/foo", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe(
      "/foo",
    );
  });

  test("/category/foo does not legacy-redirect", async ({ request }) => {
    const res = await request.get("/category/foo", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers().location).toBeUndefined();
  });

  test("trailing-slash path returns 308 to no-trailing-slash", async ({
    request,
  }) => {
    const res = await request.get("/what-is-search-engine-optimization/", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe(
      "/what-is-search-engine-optimization",
    );
  });
});
