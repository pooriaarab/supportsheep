import { test, expect } from "@playwright/test";

test.describe("Health endpoint", () => {
  test("GET /api/v1/health returns 200 with status ok", async ({ request }) => {
    const response = await request.get("/api/v1/health");

    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.environment).toBeDefined();
  });
});
