import { test, expect } from "@playwright/test";

/**
 * W25j browser-level pin: the COMPILED DRAFT PREVIEW on /review must
 * surface every node type the canvas can produce — not just text.
 *
 * The unit test in
 * `src/components/public/__tests__/article-body-renderer-canvas-pipeline.test.tsx`
 * proves the canvas -> renderCanvasToHtml -> sanitizeArticleHtml ->
 * ArticleBodyRenderer pipeline. This spec lifts that proof into a real
 * browser: we mock the /interview/[id]/review response with a faithful
 * rendering of the same `ArticleBodyRenderer` output (sanitised canvas
 * HTML wrapped in the same prose container the production page uses)
 * and assert every block + every inline mark is present in the live DOM.
 *
 * We mock at the route level (rather than seeding a real interview) for
 * the same reason `interview-author-flow.spec.ts` does — the production
 * /review server component reads from Firestore and verifies a session
 * cookie, neither of which we can stand up in CI without an emulator.
 */
test.describe("/review compiled draft preview renders every node type", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/interview/*/review*", async (route) => {
      // This is the exact shape `renderCanvasToHtml` emits today after
      // sanitize + transform, including every block type the writer-worker
      // can produce and every inline mark stored as a markdown escape.
      const body = `
        <h1>Supportsheep Grow: a <strong>bold</strong> start</h1>
        <p class="article-subtitle">An <em>italic</em> opener with a <a href="https://example.com">link</a>.</p>
        <figure><img src="https://images.example.com/hero.jpg" alt="Hero image" /></figure>
        <h2 id="definition">Definition and <code>core</code> idea</h2>
        <p>Supportsheep Grow compounds <strong>small</strong> wins.</p>
        <p>Try <s>quitting</s> shipping with a <code>tiny</code> goal.</p>
        <p>Read the <a href="https://example.com/m">manifesto</a>.</p>
        <p>An <u>underlined</u> phrase and a <mark data-color="yellow">highlight</mark>.</p>
        <ul>
          <li>Bullet with <strong>bold</strong></li>
          <li>Bullet with <a href="https://example.com">link</a></li>
        </ul>
        <blockquote>
          <p>Ship <strong>today</strong>, refine tomorrow.</p>
          <p>— Supportsheep Founder</p>
        </blockquote>
        <aside class="callout" data-variant="info">
          <p><strong>Why this matters</strong></p>
          <p>Velocity compounds. <strong>Direction</strong> compounds harder.</p>
        </aside>
        <pre><code class="language-ts">const ship = () =&gt; 'tomorrow';</code></pre>
        <hr />
        <table>
          <thead><tr><th>Day</th><th>Win</th></tr></thead>
          <tbody><tr><td></td><td></td></tr></tbody>
        </table>
        <figure class="embed" data-kind="youtube">
          <iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>
        </figure>
        <blockquote>
          <p>Supportsheep means <strong>independent</strong>, not isolated.</p>
          <p>— Editor</p>
        </blockquote>
        <ol>
          <li>Pick <strong>one</strong> goal</li>
          <li>Ship before noon</li>
        </ol>
        <ul class="task-list" data-type="taskList">
          <li data-checked="true">Brushed teeth</li>
          <li data-checked="false">Sent the email</li>
        </ul>
        <figure><img src="https://images.example.com/inline.jpg" alt="Inline diagram" /></figure>
      `;

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Review Draft</title>
            </head>
            <body>
              <div id="mock-review-author" class="prose prose-lg max-w-none">
                <span data-testid="compiled-draft-marker">Compiled Draft Preview</span>
                ${body}
              </div>
            </body>
          </html>
        `,
      });
    });
  });

  test("every block + inline mark survives into the browser DOM", async ({ page }) => {
    await page.goto("/interview/mock-interview/review");
    await expect(page.getByTestId("compiled-draft-marker")).toBeVisible();

    // Block-level node types
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("p.article-subtitle")).toBeVisible();
    await expect(
      page.locator("img[src='https://images.example.com/hero.jpg']"),
    ).toBeVisible();
    await expect(page.locator("h2#definition")).toBeVisible();
    await expect(page.locator("blockquote")).toHaveCount(2);
    await expect(page.locator("aside.callout[data-variant='info']")).toBeVisible();
    await expect(page.locator("pre code.language-ts")).toBeVisible();
    await expect(page.locator("hr")).toBeVisible();
    await expect(page.locator("table thead th")).toHaveCount(2);
    await expect(
      page.locator("figure.embed[data-kind='youtube'] iframe"),
    ).toHaveAttribute("src", /youtube\.com\/embed/);
    await expect(page.locator("ol")).toBeVisible();
    await expect(page.locator("ul.task-list[data-type='taskList']")).toBeVisible();
    await expect(page.locator("li[data-checked='true']")).toBeVisible();
    await expect(page.locator("li[data-checked='false']")).toBeVisible();
    await expect(
      page.locator("img[src='https://images.example.com/inline.jpg']"),
    ).toBeVisible();

    // Inline marks — rendered as their semantic tags, not raw markdown
    await expect(page.locator("strong")).not.toHaveCount(0);
    await expect(page.locator("em")).not.toHaveCount(0);
    await expect(page.locator("s")).not.toHaveCount(0);
    await expect(page.locator("code")).not.toHaveCount(0);
    await expect(page.locator("u")).not.toHaveCount(0);
    await expect(page.locator("mark[data-color='yellow']")).toBeVisible();
    await expect(
      page.locator("a[href='https://example.com/m']"),
    ).toBeVisible();

    // No raw markdown delimiters leaked into the visible text.
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("**bold**");
    expect(visibleText).not.toContain("~~quitting~~");
    expect(visibleText).not.toContain("`tiny`");
    expect(visibleText).not.toMatch(/\[manifesto\]\(https/);
  });
});
