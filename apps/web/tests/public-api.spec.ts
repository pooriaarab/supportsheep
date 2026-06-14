import { test, expect } from "@playwright/test";

test.describe("Public articles API", () => {
  test("serves public summaries without leaking internal fields", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/public/articles");
    expect(response.ok()).toBe(true);

    const json = await response.json();
    expect(Array.isArray(json.data)).toBe(true);
    if (json.data.length > 0) {
      expect(json.data[0].draftBody).toBeUndefined();
      // URL must be absolute and contain the article slug — hostname varies by environment.
      expect(json.data[0].url).toMatch(/^https?:\/\/.+\/.+/);
    }
    expect(json.pagination).toBeTruthy();
    expect(response.headers()["x-ratelimit-limit"]).toBeTruthy();
  });
});
