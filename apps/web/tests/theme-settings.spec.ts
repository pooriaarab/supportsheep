import { test, expect, type Page } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

type ThemeConfig = {
  publicAppearance: {
    themeMode: "light" | "dark";
    topBanner: {
      enabled: boolean;
      message: string;
      backgroundColor: string;
      textColor: string;
      scope: "homepage" | "all";
    };
    header: {
      logoUrl: string | null;
      text: string;
      backgroundColor: string;
      textColor: string;
    };
    footer: {
      logoUrl: string | null;
      text: string;
      backgroundColor: string;
      textColor: string;
    };
    article: {
      cards: {
        borderRadiusPreset: "sharp" | "soft" | "round";
        borderRadius: string;
        shadowPreset: "none" | "subtle" | "elevated";
        hoverStyle: "none" | "border" | "lift";
      };
      readingLayout: {
        contentWidthPreset: "narrow" | "standard" | "wide";
        contentWidth: string;
        bodyLineHeightPreset: "compact" | "balanced" | "airy";
        bodyLineHeight: string;
        summaryBoxStyle: "minimal" | "outlined" | "filled";
      };
      tableOfContents: {
        enabled: boolean;
        stylePreset: "minimal" | "card" | "bordered";
      };
      typography: {
        fontPreset: "default" | "editorial" | "modern";
        headingScalePreset: "compact" | "balanced" | "display";
      };
    };
  };
  homepage: {
    layout: "grid" | "sidebar" | "hybrid";
    postsPerPage: number;
    featuredCategory: string | null;
  };
};

type ThemeConfigPatch = Partial<{
  publicAppearance: Partial<{
    themeMode: ThemeConfig["publicAppearance"]["themeMode"];
    topBanner: Partial<ThemeConfig["publicAppearance"]["topBanner"]>;
    header: Partial<ThemeConfig["publicAppearance"]["header"]>;
    footer: Partial<ThemeConfig["publicAppearance"]["footer"]>;
    article: Partial<{
      cards: Partial<ThemeConfig["publicAppearance"]["article"]["cards"]>;
      readingLayout: Partial<
        ThemeConfig["publicAppearance"]["article"]["readingLayout"]
      >;
      tableOfContents: Partial<
        ThemeConfig["publicAppearance"]["article"]["tableOfContents"]
      >;
      typography: Partial<
        ThemeConfig["publicAppearance"]["article"]["typography"]
      >;
    }>;
  }>;
  homepage: Partial<ThemeConfig["homepage"]>;
}>;

function createInitialThemeConfig(): ThemeConfig {
  return {
    publicAppearance: {
      themeMode: "light",
      topBanner: {
        enabled: false,
        message:
          "This content is AI-assisted and reviewed by humans where applicable",
        backgroundColor: "#FFF4D6",
        textColor: "#5F370E",
        scope: "homepage",
      },
      header: {
        logoUrl: null,
        text: "",
        backgroundColor: "#1d1133",
        textColor: "#FFFFFF",
      },
      footer: {
        logoUrl: null,
        text: "",
        backgroundColor: "#171325",
        textColor: "#FFFFFF",
      },
      article: {
        cards: {
          borderRadiusPreset: "soft",
          borderRadius: "",
          shadowPreset: "none",
          hoverStyle: "border",
        },
        readingLayout: {
          contentWidthPreset: "standard",
          contentWidth: "",
          bodyLineHeightPreset: "balanced",
          bodyLineHeight: "",
          summaryBoxStyle: "outlined",
        },
        tableOfContents: {
          enabled: true,
          stylePreset: "bordered",
        },
        typography: {
          fontPreset: "default",
          headingScalePreset: "balanced",
        },
      },
    },
    homepage: {
      layout: "grid",
      postsPerPage: 12,
      featuredCategory: null,
    },
  };
}

async function stubThemeSettingsApis(page: Page) {
  const context = page.context();
  let currentConfig = createInitialThemeConfig();
  let patchRequests = 0;
  let lastPatchPayload: ThemeConfigPatch | null = null;

  await context.route("**/api/v1/config", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: currentConfig }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      patchRequests += 1;
      const payload = request.postDataJSON() as ThemeConfigPatch;
      lastPatchPayload = payload;

      currentConfig = {
        ...currentConfig,
        ...payload,
        publicAppearance: {
          ...currentConfig.publicAppearance,
          ...payload.publicAppearance,
          topBanner: {
            ...currentConfig.publicAppearance.topBanner,
            ...payload.publicAppearance?.topBanner,
          },
          header: {
            ...currentConfig.publicAppearance.header,
            ...payload.publicAppearance?.header,
          },
          footer: {
            ...currentConfig.publicAppearance.footer,
            ...payload.publicAppearance?.footer,
          },
          article: {
            ...currentConfig.publicAppearance.article,
            ...payload.publicAppearance?.article,
            cards: {
              ...currentConfig.publicAppearance.article.cards,
              ...payload.publicAppearance?.article?.cards,
            },
            readingLayout: {
              ...currentConfig.publicAppearance.article.readingLayout,
              ...payload.publicAppearance?.article?.readingLayout,
            },
            tableOfContents: {
              ...currentConfig.publicAppearance.article.tableOfContents,
              ...payload.publicAppearance?.article?.tableOfContents,
            },
            typography: {
              ...currentConfig.publicAppearance.article.typography,
              ...payload.publicAppearance?.article?.typography,
            },
          },
        },
        homepage: {
          ...currentConfig.homepage,
          ...payload.homepage,
        },
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: currentConfig }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/categories", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ slug: "ai", displayName: "AI", postCount: 10 }],
        }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/notifications**", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/ai/chat**", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/media", async (route, request) => {
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "media-1",
          url: "https://storage.googleapis.com/mock/theme-logo.png",
          filename: "theme-logo.png",
        }),
      });
      return;
    }

    await route.continue();
  });

  return {
    getPatchRequests: () => patchRequests,
    getLastPatchPayload: () => lastPatchPayload,
  };
}

async function stubThemeSettingsApisWithServerOverrides(
  page: Page,
  overrides: {
    backgroundColor?: string;
    textColor?: string;
    message?: string;
  },
) {
  const context = page.context();
  let currentConfig = createInitialThemeConfig();
  let patchRequests = 0;
  let lastPatchPayload: ThemeConfigPatch | null = null;

  await context.route("**/api/v1/config", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: currentConfig }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      patchRequests += 1;
      const payload = request.postDataJSON() as ThemeConfigPatch;
      lastPatchPayload = payload;

      const requestedTopBanner = payload.publicAppearance?.topBanner ?? {};
      const mergedTopBanner = {
        ...currentConfig.publicAppearance.topBanner,
        ...requestedTopBanner,
      };

      currentConfig = {
        ...currentConfig,
        ...payload,
        publicAppearance: {
          ...currentConfig.publicAppearance,
          ...payload.publicAppearance,
          topBanner: {
            ...mergedTopBanner,
            ...(overrides.backgroundColor
              ? { backgroundColor: overrides.backgroundColor }
              : {}),
            ...(overrides.textColor ? { textColor: overrides.textColor } : {}),
            ...(overrides.message ? { message: overrides.message } : {}),
          },
          header: {
            ...currentConfig.publicAppearance.header,
            ...payload.publicAppearance?.header,
          },
          footer: {
            ...currentConfig.publicAppearance.footer,
            ...payload.publicAppearance?.footer,
          },
        },
        homepage: {
          ...currentConfig.homepage,
          ...payload.homepage,
        },
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: currentConfig }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/categories", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ slug: "ai", displayName: "AI", postCount: 10 }],
        }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/notifications**", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/ai/chat**", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/api/v1/media", async (route, request) => {
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "media-1",
          url: "https://storage.googleapis.com/mock/theme-logo.png",
          filename: "theme-logo.png",
        }),
      });
      return;
    }

    await route.continue();
  });

  return {
    getPatchRequests: () => patchRequests,
    getLastPatchPayload: () => lastPatchPayload,
  };
}

test.describe("Theme settings", () => {
  test("renders the theme index with links to focused theme sections", async ({
    page,
  }) => {
    await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme");

    await expect(
      page.getByRole("heading", { name: "Theme", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Public Shell/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("link", { name: /Article Styles/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Dashboard Theme")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("renders article theme controls and saves a preset-based change", async ({
    page,
  }) => {
    const api = await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme/article");

    await expect(
      page.getByRole("heading", { name: "Article Styles" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Card border radius")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Card shadow")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Content width")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Body line height")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Show table of contents")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("TOC style")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Font preset")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Heading scale")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel("Card border radius").click();
    await page.getByRole("option", { name: "Sharp" }).click();
    await page.getByLabel("Card shadow").click();
    await page.getByRole("option", { name: "Subtle" }).click();
    await page.getByLabel("Content width").click();
    await page.getByRole("option", { name: "Wide" }).click();
    await page.getByLabel("Body line height").click();
    await page.getByRole("option", { name: "Airy" }).click();
    await page.getByLabel("Show table of contents").click();
    await page.getByLabel("TOC style").click();
    await page.getByRole("option", { name: "Card" }).click();
    await page.getByLabel("Font preset").click();
    await page.getByRole("option", { name: "Modern" }).click();
    await page.getByLabel("Heading scale").click();
    await page.getByRole("option", { name: "Display" }).click();
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect
      .poll(() => api.getLastPatchPayload(), { timeout: 15_000 })
      .not.toBeNull();

    expect(api.getLastPatchPayload()).toMatchObject({
      publicAppearance: {
        article: {
          cards: {
            borderRadiusPreset: "sharp",
            shadowPreset: "subtle",
          },
          readingLayout: {
            contentWidthPreset: "wide",
            bodyLineHeightPreset: "airy",
          },
          tableOfContents: {
            enabled: false,
            stylePreset: "card",
          },
          typography: {
            fontPreset: "modern",
            headingScalePreset: "display",
          },
        },
      },
    });
  });

  test("renders public shell branding upload and fallback controls", async ({
    page,
  }) => {
    await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme/public-shell");

    await expect(
      page.getByRole("heading", { name: "Public Shell" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Public Theme")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Enable banner")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Banner message")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Display on")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByLabel("Background color", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Background color hex")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Text color", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Text color hex")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Header logo")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Header text", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Header background color")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Header text color")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Footer logo")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Footer text", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Footer background color")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Footer text color")).toBeVisible({
      timeout: 15_000,
    });
    const previewField = page.getByText("Preview", { exact: true }).locator("xpath=..");
    await expect(
      previewField.getByText(
        "This content is AI-assisted and reviewed by humans where applicable",
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows a local validation error when banner is enabled and message is blank", async ({
    page,
  }) => {
    const api = await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme/public-shell");

    await page.getByLabel("Enable banner").click();
    await page.getByLabel("Banner message").fill("   ");
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect(
      page.getByText("Banner message is required when the banner is enabled"),
    ).toBeVisible({ timeout: 15_000 });
    expect(api.getPatchRequests()).toBe(0);
  });

  test("normalizes typed hex and re-syncs from saved config response", async ({
    page,
  }) => {
    const api = await stubThemeSettingsApisWithServerOverrides(page, {
      backgroundColor: "#DDAA33",
      textColor: "#1144CC",
      message: "Server-approved disclosure copy",
    });
    await ensureDashboardPage(page, "/settings/theme/public-shell");

    await page.getByLabel("Header logo").setInputFiles({
      name: "header.png",
      mimeType: "image/png",
      buffer: Buffer.from("header"),
    });
    await page.getByLabel("Footer logo").setInputFiles({
      name: "footer.png",
      mimeType: "image/png",
      buffer: Buffer.from("footer"),
    });
    await page.getByLabel("Header text", { exact: true }).fill("Acme Header");
    await page.getByLabel("Footer text", { exact: true }).fill("Acme Footer");
    await page.getByLabel("Header background color").fill("#221144");
    await page.getByLabel("Header text color").fill("#f5f5f5");
    await page.getByLabel("Footer background color").fill("#101820");
    await page.getByLabel("Footer text color").fill("#ededed");
    await page.getByLabel("Enable banner").click();
    await page.getByLabel("Banner message").fill("  AI disclosure updated  ");
    await page.getByLabel("Display on").click();
    await page.getByRole("option", { name: "All public pages" }).click();
    await page.getByLabel("Background color hex").fill("abc123");
    await page.getByLabel("Text color hex").fill("#f0e1d2");

    await expect(page.getByLabel("Background color", { exact: true })).toHaveValue(
      "#abc123",
      { timeout: 15_000 },
    );
    await expect(page.getByLabel("Text color", { exact: true })).toHaveValue(
      "#f0e1d2",
      { timeout: 15_000 },
    );

    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect
      .poll(() => api.getLastPatchPayload(), { timeout: 15_000 })
      .not.toBeNull();

    expect(api.getLastPatchPayload()).toMatchObject({
      publicAppearance: {
        header: {
          logoUrl: "https://storage.googleapis.com/mock/theme-logo.png",
          text: "Acme Header",
          backgroundColor: "#221144",
          textColor: "#f5f5f5",
        },
        footer: {
          logoUrl: "https://storage.googleapis.com/mock/theme-logo.png",
          text: "Acme Footer",
          backgroundColor: "#101820",
          textColor: "#ededed",
        },
        topBanner: {
          enabled: true,
          message: "AI disclosure updated",
          scope: "all",
          backgroundColor: "#ABC123",
          textColor: "#F0E1D2",
        },
      },
    });

    await expect(page.getByLabel("Banner message")).toHaveValue(
      "Server-approved disclosure copy",
      { timeout: 15_000 },
    );
    await expect(page.getByLabel("Background color hex")).toHaveValue(
      "#DDAA33",
      { timeout: 15_000 },
    );
    await expect(page.getByLabel("Text color hex")).toHaveValue("#1144CC", {
      timeout: 15_000,
    });
    await expect(page.getByLabel("Background color", { exact: true })).toHaveValue(
      "#ddaa33",
      { timeout: 15_000 },
    );
    await expect(page.getByLabel("Text color", { exact: true })).toHaveValue(
      "#1144cc",
      { timeout: 15_000 },
    );
    const previewField = page.getByText("Preview", { exact: true }).locator("xpath=..");
    await expect(previewField).toContainText("Server-approved disclosure copy", {
      timeout: 15_000,
    });
  });

  test("blocks save when a top banner hex input is invalid", async ({ page }) => {
    const api = await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme/public-shell");

    await page.getByLabel("Enable banner").click();
    await page.getByLabel("Background color hex").fill("#12FG45");
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect(
      page.getByText("Background color must be a 6-digit hex code"),
    ).toBeVisible({ timeout: 15_000 });
    expect(api.getPatchRequests()).toBe(0);
  });

  test("allows saving unrelated theme changes when banner is disabled and a hex input is invalid", async ({
    page,
  }) => {
    const api = await stubThemeSettingsApis(page);
    await ensureDashboardPage(page, "/settings/theme/public-shell");

    await page.getByLabel("Background color hex").fill("#12FG45");
    const publicThemeField = page.getByText("Public Theme").locator("xpath=..");
    await publicThemeField.getByRole("combobox").click();
    await page.getByRole("option", { name: "Dark" }).click();
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect
      .poll(() => api.getLastPatchPayload(), { timeout: 15_000 })
      .not.toBeNull();
    expect(api.getLastPatchPayload()).toMatchObject({
      publicAppearance: {
        themeMode: "dark",
        topBanner: {
          enabled: false,
          backgroundColor: "#FFF4D6",
          textColor: "#5F370E",
        },
      },
    });
    await expect(
      page.getByText("Background color must be a 6-digit hex code"),
    ).toHaveCount(0);
  });
});
