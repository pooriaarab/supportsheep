import { expect, test } from "@playwright/test";
import { resolvePublicSiteUrl } from "@/lib/public-site";

test.describe("Agent readiness discovery baseline", () => {
  test("publishes the service-doc/api-catalog header, robots signal, server card, and skills index", async ({
    request,
  }) => {
    const siteUrl = resolvePublicSiteUrl();
    const [home, serverCard, agentCard, skillsIndex, skillFile, robots] =
      await Promise.all([
        request.get("/"),
        request.get("/.well-known/mcp/server-card.json"),
        request.get("/.well-known/agent-card.json"),
        request.get("/.well-known/agent-skills/index.json"),
        request.get("/.well-known/agent-skills/blogbat-discovery/SKILL.md"),
        request.get("/robots.txt"),
      ]);

    expect(home.ok()).toBe(true);
    const linkHeader = home.headers()["link"] ?? "";
    expect(linkHeader).toContain('</docs/api>; rel="service-doc"');
    expect(linkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"',
    );

    expect(serverCard.ok()).toBe(true);
    const card = await serverCard.json();
    expect(card.transport.endpoint).toBe("/api/v1/mcp");
    expect(card.authentication).toEqual({
      required: true,
      schemes: ["bearer"],
    });
    expect(serverCard.headers()["access-control-allow-origin"]).toBe("*");

    expect(agentCard.ok()).toBe(true);
    const publicAgent = await agentCard.json();
    expect(publicAgent.url).toBe(`${siteUrl}/api/v1/public/articles`);
    expect(publicAgent.preferredTransport).toBe("HTTP+JSON");
    expect(publicAgent.skills.map((skill: { id: string }) => skill.id)).toEqual(
      expect.arrayContaining([
        "list-public-articles",
        "read-public-article",
        "search-public-articles",
      ]),
    );
    expect(agentCard.headers()["access-control-allow-origin"]).toBe("*");

    expect(skillsIndex.ok()).toBe(true);
    const skills = await skillsIndex.json();
    expect(skills.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    expect(skills.skills[0].type).toBe("skill-md");
    expect(skills.skills[0].url).toBe(
      "/.well-known/agent-skills/blogbat-discovery/SKILL.md",
    );
    expect(skills.skills[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    expect(skillFile.ok()).toBe(true);
    expect(skillFile.headers()["content-type"] ?? "").toContain(
      "text/markdown",
    );
    expect(skillFile.headers()["access-control-allow-origin"]).toBe("*");
    expect(await skillFile.text()).toContain("# BlogBat Discovery");

    const robotsTxt = await robots.text();
    expect(robotsTxt).toContain(
      "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
    );
    expect(robotsTxt).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);
  });

  test("serves the api catalog linkset", async ({ request }) => {
    const siteUrl = resolvePublicSiteUrl();
    const response = await request.get("/.well-known/api-catalog");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"] ?? "").toContain(
      "application/linkset+json",
    );

    const catalog = await response.json();
    expect(
      catalog.linkset.map((entry: { anchor: string }) => entry.anchor),
    ).toEqual(
      expect.arrayContaining([
        `${siteUrl}/api/v1/public/articles`,
        `${siteUrl}/api/v1/public/articles/{slug}`,
        `${siteUrl}/api/search`,
        `${siteUrl}/api/feed`,
        `${siteUrl}/api/markdown`,
      ]),
    );
    expect(catalog.linkset[0]).toMatchObject({
      links: expect.arrayContaining([
        expect.objectContaining({
          rel: "service-doc",
          href: `${siteUrl}/docs/api`,
        }),
        expect.objectContaining({
          rel: "status",
          href: `${siteUrl}/api/v1/health`,
        }),
      ]),
    });
  });

  test("serves the public api docs page", async ({ request }) => {
    const response = await request.get("/docs/api");

    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain("Public Articles API");
    expect(html).toContain("GET /api/v1/public/articles");
    expect(html).toContain("GET /api/v1/public/articles/:slug");
    expect(html).toContain("Rate limits &amp; errors");
  });
});

test.describe("Markdown content negotiation", () => {
  test("returns markdown when agents request text/markdown", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: {
        Accept: "text/markdown",
      },
    });

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"] ?? "").toContain("text/markdown");
    expect(response.headers()["vary"] ?? "").toContain("Accept");
    expect(response.headers()["x-correlation-id"]).toMatch(/^[\w-]{1,64}$/);
    // Body must be markdown (heading present) — exact title varies by deployment.
    expect(await response.text()).toMatch(/^#/m);
  });

  test("returns docs markdown for /docs requests", async ({ request }) => {
    const response = await request.get("/docs", {
      headers: {
        Accept: "text/markdown",
      },
    });

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"] ?? "").toContain("text/markdown");
    expect(response.headers()["vary"] ?? "").toContain("Accept");
    expect(await response.text()).toContain("# Documentation");
  });

  test("returns markdown 404 for unsupported markdown paths", async ({
    request,
  }) => {
    const response = await request.get("/not-a-supported-markdown-route/deep", {
      headers: {
        Accept: "Text/Markdown",
      },
    });

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"] ?? "").toContain("text/markdown");
    expect(response.headers()["vary"] ?? "").toContain("Accept");
    expect(await response.text()).toContain("# Not Found");
  });
});
