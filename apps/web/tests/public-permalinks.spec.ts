import { test, expect } from "@playwright/test";

test.describe("Public permalink routing", () => {
  test("redirects legacy blog article paths to root canonicals", async ({
    request,
  }) => {
    const response = await request.get(
      "/blog/Uncategorized/ideas-for-personal-websites",
      {
        maxRedirects: 0,
      },
    );

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.headers().location).toBe("/ideas-for-personal-websites");
  });
});
