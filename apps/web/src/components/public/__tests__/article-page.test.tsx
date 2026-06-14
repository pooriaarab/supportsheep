import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArticlePage,
  extractFaqEntries,
  extractHowToSteps,
  renderArticleBodySafely,
} from "@/components/public/article-page";
import { AI_DISCLOSURE_TEXT } from "@/lib/articles/prepend-ai-disclosure";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import type { Article, Author } from "@repo/types";

const article: Article & { id: string } = {
  id: "article-1",
  blogId: "default",
  title: "How to Launch a Small Business Website",
  slug: "how-to-launch-a-small-business-website",
  body: "<p>Body copy</p>",
  draftBody: "",
  excerpt: "Excerpt",
  summary: "",
  status: "published",
  scheduledAt: null,
  publishedAt: "2026-04-15T00:00:00.000Z",
  postType: "how_to",
  category: "guides",
  tags: [],
  author: "BlogBat",
  featuredImage: { url: "", alt: "" },
  ogImage: "",
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  seoScore: 0,
  internalLinks: [],
  externalLinks: [],
  versions: [],
  generatedBy: "manual",
  generationMeta: null,
  wordCount: 120,
  readingTime: 1,
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-15T00:00:00.000Z",
};

describe("ArticlePage", () => {
  it("renders the CTA rail without the old categories sidebar heading", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain("Start your own blog");
    expect(html).toContain("Powered by BlogBat");
    expect(html).not.toContain(">Categories<");
  });

  it("injects heading anchor ids and renders a table of contents", () => {
    const withHeadings: Article & { id: string } = {
      ...article,
      body: "<h2>First Section</h2><p>Copy</p><h3>Sub point</h3><h2>Second Section</h2>",
    };

    const html = renderToStaticMarkup(
      <ArticlePage
        article={withHeadings}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(html).toContain('<h3 id="sub-point">Sub point</h3>');
    expect(html).toContain('<h2 id="second-section">Second Section</h2>');
    expect(html).toContain("On this page");
    expect(html).toContain('href="#first-section"');
    expect(html).toContain('href="#second-section"');
  });

  it("omits the table of contents when the body has no tracked headings", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain("On this page");
  });

  it("omits the table of contents when the article theme disables it", () => {
    const withHeadings: Article & { id: string } = {
      ...article,
      body: "<h2>First Section</h2><p>Copy</p><h3>Sub point</h3>",
    };

    const html = renderToStaticMarkup(
      <ArticlePage
        article={withHeadings}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
        articleTheme={resolvePublicArticleTheme({
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
            enabled: false,
            stylePreset: "bordered",
          },
          typography: {
            fontPreset: "default",
            headingScalePreset: "balanced",
          },
        })}
      />,
    );

    expect(html).not.toContain("On this page");
  });

  it("emits VideoObject JSON-LD for each embedded YouTube video", () => {
    const bodyWithVideos = [
      '<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>',
      '<p>See https://youtu.be/abc123XYZ_- for more.</p>',
      '<p>Also <a href="https://www.youtube.com/watch?v=9bZkp7q19f0&feature=share">this one</a>.</p>',
      '<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>',
    ].join("");

    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, body: bodyWithVideos }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    const videoObjectCount = (html.match(/"@type":"VideoObject"/g) ?? []).length;
    expect(videoObjectCount).toBe(3);
    expect(html).toContain(
      '"thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"',
    );
    expect(html).toContain(
      '"embedUrl":"https://www.youtube.com/embed/abc123XYZ_-"',
    );
    expect(html).toContain(
      '"contentUrl":"https://www.youtube.com/watch?v=9bZkp7q19f0"',
    );
    expect(html).toContain('"uploadDate":"2026-04-15T00:00:00.000Z"');
  });

  it("does not emit VideoObject JSON-LD when the body has no YouTube videos", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('"@type":"VideoObject"');
  });

  it("omits date fields from JSON-LD when Firestore stores a malformed date string", () => {
    const bodyWithVideo =
      '<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>';
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          body: bodyWithVideo,
          publishedAt: "not-a-real-date",
          createdAt: "also-not-a-date",
          updatedAt: "garbage",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('"datePublished":"not-a-real-date"');
    expect(html).not.toContain('"dateModified":"garbage"');
    expect(html).not.toContain('"uploadDate":"not-a-real-date"');
  });

  it("renders sparse imported article metadata without crashing", () => {
    const sparseArticle = {
      ...article,
      author: "",
      tags: undefined,
      keywords: "seo, websites",
    } as unknown as Article & { id: string };

    const html = renderToStaticMarkup(
      <ArticlePage
        article={sparseArticle}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain("BlogBat");
    expect(html).toContain('"name":"BlogBat"');
    expect(html).toContain('"author":{"@type":"Organization","name":"BlogBat"}');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).not.toContain("Unknown");
    expect(html).not.toContain('"keywords":"s,e,o');
  });

  it("emits FAQPage JSON-LD when the body contains a FAQ section", () => {
    const bodyWithFaq = `
      <p>Intro</p>
      <section class="faq" data-block="faq">
        <div class="faq-item">
          <h3 class="faq-question">What is BlogBat?</h3>
          <div class="faq-answer"><p>A small business website builder.</p></div>
        </div>
        <div class="faq-item">
          <h3 class="faq-question">Is it free?</h3>
          <div class="faq-answer"><p>Yes, the starter plan is free.</p></div>
        </div>
      </section>
    `;

    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, body: bodyWithFaq }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"Question"');
    expect(html).toContain("What is BlogBat?");
    expect(html).toContain("A small business website builder.");
    expect(html).toContain("Is it free?");
  });

  it("omits FAQPage JSON-LD when the body has no FAQ section", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('"@type":"FAQPage"');
  });

  it("does not throw when featuredImage is a legacy string value", () => {
    const legacyArticle = {
      ...article,
      featuredImage: "https://example.com/legacy.jpg",
    } as unknown as Article & { id: string };

    expect(() =>
      renderToStaticMarkup(
        <ArticlePage
          article={legacyArticle}
          relatedArticles={[]}
          categories={[]}
          siteUrl="https://blogbat.com"
        />,
      ),
    ).not.toThrow();
  });

  it("does not throw when featuredImage is null or undefined", () => {
    const sparseArticle = {
      ...article,
      featuredImage: null,
    } as unknown as Article & { id: string };

    expect(() =>
      renderToStaticMarkup(
        <ArticlePage
          article={sparseArticle}
          relatedArticles={[]}
          categories={[]}
          siteUrl="https://blogbat.com"
        />,
      ),
    ).not.toThrow();
  });

  it("renders a fallback body when the transform pipeline throws", () => {
    const result = renderArticleBodySafely("article-1", "<p>hello</p>");
    expect(result).toHaveProperty("html");
    expect(result).toHaveProperty("headings");
  });

  it("renders the author byline as a link and emits rich Person JSON-LD when a named author is provided", () => {
    const author: Author = {
      id: "jane-doe",
      name: "Jane Doe",
      jobTitle: "Senior Editor",
      bio: "Jane writes about small business websites.",
      avatarUrl: "https://cdn.example.com/jane.png",
      sameAs: ["https://www.linkedin.com/in/jane-doe"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, authorId: "jane-doe", author: "Legacy String" }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
        author={author}
      />,
    );

    expect(html).toContain('href="/authors/jane-doe"');
    expect(html).toContain("Jane Doe");
    expect(html).not.toContain("Legacy String");
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"name":"Jane Doe"');
    expect(html).toContain('"jobTitle":"Senior Editor"');
    expect(html).toContain('"url":"https://blogbat.com/authors/jane-doe"');
    expect(html).toContain(
      '"sameAs":["https://www.linkedin.com/in/jane-doe"]',
    );
    expect(html).toContain('"image":"https://cdn.example.com/jane.png"');
  });

  it("falls back to the legacy author string and Organization schema when no named author is attached", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('href="/authors/');
    expect(html).toContain('"author":{"@type":"Organization","name":"BlogBat"}');
  });

  it("emits BlogPosting with url, inLanguage, articleSection, and publisher logo dimensions", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain(
      '"url":"https://blogbat.com/how-to-launch-a-small-business-website"',
    );
    expect(html).toContain('"inLanguage":"en-US"');
    expect(html).toContain('"articleSection":"Guides"');
    expect(html).toContain(
      '"logo":{"@type":"ImageObject","url":"https://blogbat.com/favicon.png","width":112,"height":112}',
    );
  });

  it("title-cases multi-word category slugs in articleSection", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, category: "website-tips" }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"articleSection":"Website Tips"');
    expect(html).not.toContain('"articleSection":"website-tips"');
  });

  it("prefers the display name over the slug for articleSection", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, category: "website-tips" }}
        relatedArticles={[]}
        categories={[
          {
            slug: "website-tips",
            displayName: "Website Tips & Tricks",
            description: "",
            order: 0,
            icon: "",
            postCount: 0,
          },
        ]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"articleSection":"Website Tips & Tricks"');
  });

  it("wraps the article image as an ImageObject with fallback dimensions", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          ogImage: "https://cdn.example.com/hero.jpg",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain(
      '"image":{"@type":"ImageObject","url":"https://cdn.example.com/hero.jpg","width":1200,"height":630}',
    );
  });

  it("falls back to /og.png when no article image is set", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain(
      '"image":{"@type":"ImageObject","url":"https://blogbat.com/og.png","width":1200,"height":630}',
    );
  });

  it("uses featured image intrinsic dimensions when available", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          ogImage: "",
          featuredImage: {
            url: "https://cdn.example.com/hero.jpg",
            alt: "",
            width: 1600,
            height: 900,
          },
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain(
      '"image":{"@type":"ImageObject","url":"https://cdn.example.com/hero.jpg","width":1600,"height":900}',
    );
  });

  it("emits Speakable schema on the BlogPosting JSON-LD", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"speakable":{');
    expect(html).toContain('"@type":"SpeakableSpecification"');
    expect(html).toContain(
      '"cssSelector":[".article-summary",".article-excerpt","article h1"]',
    );
  });

  it("renders the TL;DR callout with the article-summary class when summary is set", () => {
    const summary =
      "BlogBat is a minimal platform for small business sites. It gives you a blog, custom domain, SEO-ready pages, and a lightweight editor so you can focus on writing instead of configuring tools.";
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, summary }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain("article-summary");
    expect(html).toContain("TL;DR");
    expect(html).toContain(summary);
  });

  it("renders default article surfaces with tighter radius and no shadow", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          summary: "Short summary",
          body: "<h2>First Section</h2><p>Copy</p>",
          featuredImage: {
            url: "https://example.com/hero.jpg",
            alt: "Hero",
          },
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
        articleTheme={resolvePublicArticleTheme(undefined)}
      />,
    );

    expect(html).toContain("rounded-xl");
    expect(html).not.toContain("rounded-[2rem]");
    expect(html).not.toContain("shadow-[0_24px_80px_-52px_rgba(20,24,35,0.45)]");
    expect(html).not.toContain("shadow-[0_12px_40px_-28px_rgba(20,24,35,0.45)]");
  });

  it("applies body line height controls to prose paragraphs", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          body: "<h2>First Section</h2><p>Body copy</p><ul><li>List item</li></ul>",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
        articleTheme={resolvePublicArticleTheme({
          cards: {
            borderRadiusPreset: "soft",
            borderRadius: "",
            shadowPreset: "none",
            hoverStyle: "border",
          },
          readingLayout: {
            contentWidthPreset: "standard",
            contentWidth: "",
            bodyLineHeightPreset: "airy",
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
        })}
      />,
    );

    expect(html).toContain("prose-p:leading-[var(--article-body-line-height)]");
    expect(html).toContain("prose-li:leading-[var(--article-body-line-height)]");
    expect(html).toContain("--article-body-line-height:1.95");
  });

  it("renders the disclosure above the TL;DR and strips the duplicated body paragraph", () => {
    const bodyWithDisclosure = `<p><em>${AI_DISCLOSURE_TEXT}</em></p><p>Body copy</p>`;
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, summary: "Short summary", body: bodyWithDisclosure }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain(AI_DISCLOSURE_TEXT);
    expect(html.indexOf(AI_DISCLOSURE_TEXT)).toBeLessThan(html.indexOf("TL;DR"));
    expect((html.match(new RegExp(AI_DISCLOSURE_TEXT, "g")) ?? []).length).toBe(1);
  });

  it("falls back to article-excerpt class when no summary is set", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('class="article-summary');
    expect(html).toContain('class="article-excerpt');
    expect(html).toContain("Excerpt");
  });

  it("renders Published: without Updated: when updatedAt is within 24h of publishedAt", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          publishedAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T03:00:00.000Z",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain("Published:");
    expect(html).not.toContain("Updated:");
  });

  it("renders Updated: with a dateTime attribute when updatedAt is >24h after publishedAt", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          publishedAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-18T00:00:00.000Z",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain("Published:");
    expect(html).toContain("Updated:");
    expect(html).toContain('dateTime="2026-04-18T00:00:00.000Z"');
  });

  it("omits Updated: when updatedAt is unparseable", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={{
          ...article,
          publishedAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "not-a-real-date",
        }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain("Updated:");
  });
});

describe("extractFaqEntries", () => {
  it("returns an empty array when no FAQ markup is present", () => {
    expect(extractFaqEntries("<p>plain body</p>")).toEqual([]);
    expect(extractFaqEntries("")).toEqual([]);
  });

  it("parses question and answer pairs and strips nested markup", () => {
    const body = `
      <section class="faq" data-block="faq">
        <div class="faq-item">
          <h3 class="faq-question">First <strong>question</strong>?</h3>
          <div class="faq-answer"><p>Answer <em>one</em>.</p></div>
        </div>
        <div class="faq-item">
          <h3 class="faq-question">Second?</h3>
          <div class="faq-answer"><p>Answer two.</p></div>
        </div>
      </section>
    `;

    const entries = extractFaqEntries(body);
    expect(entries).toEqual([
      { question: "First question?", answer: "Answer one." },
      { question: "Second?", answer: "Answer two." },
    ]);
  });

  it("skips items with empty questions or empty answers", () => {
    const body = `
      <section class="faq" data-block="faq">
        <div class="faq-item">
          <h3 class="faq-question"></h3>
          <div class="faq-answer"><p>Orphan answer.</p></div>
        </div>
        <div class="faq-item">
          <h3 class="faq-question">Real question?</h3>
          <div class="faq-answer"><p>Real answer.</p></div>
        </div>
      </section>
    `;

    expect(extractFaqEntries(body)).toEqual([
      { question: "Real question?", answer: "Real answer." },
    ]);
  });

  it("deduplicates identical question/answer pairs across multiple sections", () => {
    const body = `
      <section class="faq" data-block="faq">
        <div class="faq-item">
          <h3 class="faq-question">Dup?</h3>
          <div class="faq-answer"><p>Same.</p></div>
        </div>
      </section>
      <section class="faq" data-block="faq">
        <div class="faq-item">
          <h3 class="faq-question">Dup?</h3>
          <div class="faq-answer"><p>Same.</p></div>
        </div>
      </section>
    `;

    expect(extractFaqEntries(body)).toEqual([
      { question: "Dup?", answer: "Same." },
    ]);
  });
});

describe("ArticlePage HowTo JSON-LD", () => {
  it("emits HowTo JSON-LD when the body contains a HowTo section", () => {
    const bodyWithHowTo = `
      <p>Intro</p>
      <section class="howto" data-block="howto">
        <ol class="howto-steps">
          <li class="howto-step">
            <h3 class="howto-step-name">Pick a domain</h3>
            <div class="howto-step-content"><p>Choose a short, memorable name.</p></div>
          </li>
          <li class="howto-step">
            <h3 class="howto-step-name">Publish your site</h3>
            <div class="howto-step-content"><p>Click the publish button in the editor.</p></div>
          </li>
        </ol>
      </section>
    `;

    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...article, body: bodyWithHowTo, excerpt: "How to launch" }}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).toContain('"@type":"HowTo"');
    expect(html).toContain('"@type":"HowToStep"');
    expect(html).toContain('"name":"How to Launch a Small Business Website"');
    expect(html).toContain("Pick a domain");
    expect(html).toContain("Choose a short, memorable name.");
    expect(html).toContain("Publish your site");
    expect(html).toContain('"description":"How to launch"');
  });

  it("omits HowTo JSON-LD when the body has no HowTo section", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={article}
        relatedArticles={[]}
        categories={[]}
        siteUrl="https://blogbat.com"
      />,
    );

    expect(html).not.toContain('"@type":"HowTo"');
  });
});

describe("extractHowToSteps", () => {
  it("returns an empty array when no HowTo markup is present", () => {
    expect(extractHowToSteps("<p>plain body</p>")).toEqual([]);
    expect(extractHowToSteps("")).toEqual([]);
  });

  it("parses step name and text pairs and strips nested markup", () => {
    const body = `
      <section class="howto" data-block="howto">
        <ol class="howto-steps">
          <li class="howto-step">
            <h3 class="howto-step-name">First <strong>step</strong></h3>
            <div class="howto-step-content"><p>Do <em>this</em>.</p></div>
          </li>
          <li class="howto-step">
            <h3 class="howto-step-name">Second step</h3>
            <div class="howto-step-content"><p>Then that.</p></div>
          </li>
        </ol>
      </section>
    `;

    const entries = extractHowToSteps(body);
    expect(entries).toEqual([
      { name: "First step", text: "Do this." },
      { name: "Second step", text: "Then that." },
    ]);
  });

  it("skips steps with empty names or empty content", () => {
    const body = `
      <section class="howto" data-block="howto">
        <ol class="howto-steps">
          <li class="howto-step">
            <h3 class="howto-step-name"></h3>
            <div class="howto-step-content"><p>Orphan text.</p></div>
          </li>
          <li class="howto-step">
            <h3 class="howto-step-name">Real step</h3>
            <div class="howto-step-content"><p>Real text.</p></div>
          </li>
        </ol>
      </section>
    `;

    expect(extractHowToSteps(body)).toEqual([
      { name: "Real step", text: "Real text." },
    ]);
  });

  it("deduplicates identical step name/text pairs across multiple sections", () => {
    const body = `
      <section class="howto" data-block="howto">
        <ol class="howto-steps">
          <li class="howto-step">
            <h3 class="howto-step-name">Dup</h3>
            <div class="howto-step-content"><p>Same.</p></div>
          </li>
        </ol>
      </section>
      <section class="howto" data-block="howto">
        <ol class="howto-steps">
          <li class="howto-step">
            <h3 class="howto-step-name">Dup</h3>
            <div class="howto-step-content"><p>Same.</p></div>
          </li>
        </ol>
      </section>
    `;

    expect(extractHowToSteps(body)).toEqual([
      { name: "Dup", text: "Same." },
    ]);
  });
});
