import { expect, test } from "@playwright/test";

test("guest post submission page is public and linked from the footer", async ({
  page,
  request,
}) => {
  const [robotsResponse, sitemapResponse] = await Promise.all([
    request.get("/robots.txt"),
    request.get("/sitemap-articles.xml"),
  ]);
  const [robotsText, sitemapXml] = await Promise.all([
    robotsResponse.text(),
    sitemapResponse.text(),
  ]);

  expect(robotsResponse.ok()).toBe(true);
  expect(sitemapResponse.ok()).toBe(true);
  expect(robotsText).toContain("Allow: /guest-post");
  expect(sitemapXml).toContain("/guest-post");

  const pageResponse = await request.get("/guest-post");
  const contentSecurityPolicy =
    pageResponse.headers()["content-security-policy"];
  expect(contentSecurityPolicy).toContain("frame-src");
  expect(contentSecurityPolicy).toContain("https://tally.so");

  await page.goto("/guest-post");

  await expect(
    page.getByRole("heading", { name: "Submit a guest blog backlink request" }),
  ).toBeVisible();
  await expect(
    page.getByText("published a live article that links to BlogBat"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Submit guest post" }),
  ).toHaveAttribute("href", "#guest-post-form");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Tools" }),
  ).toHaveAttribute("href", "/tools");
  await expect(page.getByRole("banner").locator("img").first()).toBeVisible();
  await expect(
    page.getByRole("contentinfo").locator("img").first(),
  ).toBeVisible();
  await expect(page.getByText("Required submission fields")).toHaveCount(0);
  await expect(page.getByText("Your name")).toHaveCount(0);
  await expect(
    page.getByText("Published article URL that links to BlogBat"),
  ).toHaveCount(0);
  await expect(
    page.getByText("URL you want BlogBat to consider linking to"),
  ).toHaveCount(0);
  const submitLink = page.getByRole("link", { name: "Submit guest post" });
  const whatToIncludeHeading = page.getByRole("heading", {
    name: "What to include",
  });
  const [submitLinkBox, whatToIncludeBox] = await Promise.all([
    submitLink.boundingBox(),
    whatToIncludeHeading.boundingBox(),
  ]);
  expect(submitLinkBox).not.toBeNull();
  expect(whatToIncludeBox).not.toBeNull();
  expect(whatToIncludeBox!.y).toBeGreaterThan(
    submitLinkBox!.y + submitLinkBox!.height + 20,
  );
  await expect(
    page.locator('iframe[title="BlogBat backlink request"]'),
  ).toHaveAttribute("src", /tally\.so\/embed\/rj0MPR/);
  await expect(
    page.getByRole("button", { name: "Load details into Tally" }),
  ).toHaveCount(0);
  await expect(page.getByText("Submit to Tally")).toHaveCount(0);

  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Guest post submissions" }),
  ).toHaveAttribute("href", "/guest-post");
});
