import { test, expect } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

/**
 * Smoke test for the prosemirror-model dedupe fix.
 *
 * Pressing Enter inside the canvas editor previously threw:
 *   Uncaught RangeError: Can not convert <> to a Fragment
 *     (looks like multiple versions of prosemirror-model were loaded)
 *
 * This test mounts the post editor (which uses the same RichTextEditorShell
 * as the interview canvas), types "hello{Enter}world", and asserts that no
 * uncaught page error is raised. Any prosemirror duplication regression
 * will surface here before it ships.
 */
test.describe("canvas editor Enter key", () => {
  test("does not throw 'multiple versions of prosemirror-model' on Enter", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    // Create a fresh draft post, then open its editor.
    await ensureDashboardPage(page, "/posts/new");

    const titleInput = page.getByLabel(/title/i).first();
    await titleInput.fill(`Dedupe smoke ${Date.now()}`);
    await page.getByRole("button", { name: /create/i }).click();

    // Wait for the editor route to load.
    await page.waitForURL(/\/posts\/[^/]+\/edit/, { timeout: 15_000 });

    // ProseMirror exposes contenteditable inside the editor shell.
    const editor = page.locator(".ProseMirror").first();
    await editor.waitFor({ state: "visible", timeout: 15_000 });
    await editor.click();
    await page.keyboard.type("hello");
    await page.keyboard.press("Enter");
    await page.keyboard.type("world");

    // Allow a tick for any thrown errors to bubble.
    await page.waitForTimeout(150);

    const fragmentErrors = pageErrors.filter((err) =>
      /Fragment|prosemirror-model/i.test(err.message),
    );
    expect(
      fragmentErrors,
      `Enter key triggered prosemirror duplication errors: ${fragmentErrors
        .map((e) => e.message)
        .join(" | ")}`,
    ).toEqual([]);

    // The editor must contain both words on separate lines.
    const text = (await editor.textContent()) ?? "";
    expect(text).toContain("hello");
    expect(text).toContain("world");
  });
});
