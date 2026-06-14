import type { Page } from "@playwright/test";

export async function ensureDashboardPage(
  page: Page,
  pathname: string,
): Promise<void> {
  await page.goto(pathname);

  if (!page.url().includes("/login")) {
    return;
  }

  const loginResponse = await page.context().request.post(
    "/api/v1/auth/test-login",
    {
      data: { email: "dev@example.com" },
    },
  );

  if (!loginResponse.ok()) {
    throw new Error(`Unable to access ${pathname}: test login failed`);
  }

  await page.goto(pathname);
}
