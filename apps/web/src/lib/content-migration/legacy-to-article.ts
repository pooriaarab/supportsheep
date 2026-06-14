import type {
  Competitor,
  CompetitorProsCons,
  Pillar,
  ProgrammaticFaq,
} from "@repo/types";
import { buildFaqBlockHtml } from "@/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

export interface LegacyArticleDraft {
  title: string;
  slug: string;
  body: string;
  draftBody: string;
  excerpt: string;
  summary: string;
  postType:
    | "blog_post"
    | "listicle"
    | "how_to"
    | "comparison"
    | "product_review"
    | "pillar_page"
    | "glossary"
    | "landing_page";
  category: string;
  primaryCategory: string;
  categories: string[];
  tags: string[];
  keywords: string[];
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  sourcePath: string | null;
  legacyPaths: string[];
}

export interface CompetitorNarrativeInput {
  tldr: string;
  chooseBlogBatIf: string;
  chooseCompetitorIf: string;
  faqs: Array<{ question: string; answer: string }>;
}

interface LegacyProgrammaticPageInput {
  id: string;
  collection: string;
  title: string;
  metaDescription: string;
  uniqueContent: string;
  faqs?: ProgrammaticFaq[];
  variables: Record<string, string>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, url) => `<a href="${escapeHtml(url)}">${label}</a>`,
  );
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/(^|\s)_([^_]+)_/g, "$1<em>$2</em>");
  return result;
}

function renderBlock(block: string): string {
  const h1 = /^#\s+(.+)$/.exec(block);
  if (h1) return `<h1>${renderInline(h1[1]!)}</h1>`;
  const h2 = /^##\s+(.+)$/.exec(block);
  if (h2) return `<h2>${renderInline(h2[1]!)}</h2>`;
  const h3 = /^###\s+(.+)$/.exec(block);
  if (h3) return `<h3>${renderInline(h3[1]!)}</h3>`;

  const lines = block.split("\n");
  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    const items = lines
      .map((line) => `<li>${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  const orderedItems = block.match(/^\d+\.\s+/m);
  if (orderedItems && lines.every((line) => /^\d+\.\s+/.test(line))) {
    const items = lines
      .map((line) => `<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  return `<p>${renderInline(block.replace(/\n/g, " "))}</p>`;
}

export function renderMarkdownishBodyToHtml(body: string): string {
  if (!body.trim()) return "";
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .flatMap((block) => {
      const trimmedBlock = block.trim();
      return trimmedBlock ? [trimmedBlock] : [];
    });
  return sanitizeArticleHtml(blocks.map(renderBlock).join("\n"));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraphText(html: string): string {
  const match = html.match(/<p>(.*?)<\/p>/i);
  return stripHtml(match?.[0] ?? html);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
}

function buildCtaSection(
  subhead: string,
  ctaText: string,
  ctaHref: string,
): string {
  return sanitizeArticleHtml(`
    <section>
      <h2>Why use BlogBat for this page?</h2>
      <p>${escapeHtml(subhead)}</p>
      <p><a href="${escapeHtml(ctaHref)}">${escapeHtml(ctaText)}</a></p>
    </section>
  `);
}

function appendFaq(
  bodyHtml: string,
  faqs: ProgrammaticFaq[] | undefined,
): string {
  if (!faqs?.length) return bodyHtml;
  return sanitizeArticleHtml(`${bodyHtml}\n${buildFaqBlockHtml(faqs)}`);
}

function normalizeBody(
  body: string,
  faqs?: ProgrammaticFaq[],
  cta?: { subhead?: string; ctaText?: string; ctaHref?: string },
): string {
  let html = renderMarkdownishBodyToHtml(body);
  if (cta?.subhead || cta?.ctaText || cta?.ctaHref) {
    html = sanitizeArticleHtml(
      `${html}\n${buildCtaSection(
        cta.subhead?.trim() || "",
        cta.ctaText?.trim() || "Create your website with BlogBat",
        cta.ctaHref?.trim() || "https://blogbat.com",
      )}`,
    );
  }
  return appendFaq(html, faqs);
}

function deriveSummary(metaDescription: string, bodyHtml: string): string {
  const source = metaDescription.trim() || firstParagraphText(bodyHtml);
  return truncate(source, 280);
}

function deriveExcerpt(metaDescription: string, bodyHtml: string): string {
  const source = metaDescription.trim() || firstParagraphText(bodyHtml);
  return truncate(source, 240);
}

export function appendFaqBlock(body: string, faqs: ProgrammaticFaq[] = []) {
  return appendFaq(body, faqs);
}

export function convertProgrammaticToArticleInput(
  page: LegacyProgrammaticPageInput,
): LegacyArticleDraft {
  const body = normalizeBody(page.uniqueContent, page.faqs, {
    subhead: page.variables.subhead,
    ctaText: page.variables.ctaText,
    ctaHref: page.variables.ctaHref,
  });
  const slug =
    page.collection === "alternatives_for_vertical"
      ? page.id.replace(/__/g, "-for-")
      : page.id;

  return {
    title: page.title,
    slug,
    body,
    draftBody: body,
    excerpt: deriveExcerpt(page.metaDescription, body),
    summary: deriveSummary(page.metaDescription, body),
    postType: page.collection === "for" ? "landing_page" : "comparison",
    category: page.collection === "for" ? "niches" : "web-builders",
    primaryCategory: page.collection === "for" ? "niches" : "web-builders",
    categories: [page.collection === "for" ? "niches" : "web-builders"],
    tags:
      page.collection === "for"
        ? ["vertical-page", page.id]
        : ["vertical-comparison", ...page.id.split("__")],
    keywords:
      page.collection === "for"
        ? [page.id, `${page.id} website`, `${page.id} website builder`]
        : page.id.split("__"),
    metaTitle: page.title,
    metaDescription: page.metaDescription,
    canonicalPath: `/${slug}`,
    sourcePath: page.collection === "for" ? `/for/${page.id}` : null,
    legacyPaths: page.collection === "for" ? [`/for/${page.id}`] : [],
  };
}

export function convertPillarToArticleInput(
  pillar: Pick<
    Pillar,
    "slug" | "title" | "summary" | "heroEyebrow" | "clusters"
  >,
): LegacyArticleDraft {
  const sections = pillar.clusters
    .map((cluster) => {
      const links = cluster.articleSlugs
        .map(
          (slug) =>
            `<li><a href="/${escapeHtml(slug)}">${escapeHtml(slug)}</a></li>`,
        )
        .join("");
      return `
        <section>
          <h2>${escapeHtml(cluster.title)}</h2>
          <p>${escapeHtml(cluster.description ?? "")}</p>
          <ul>${links}</ul>
        </section>
      `;
    })
    .join("\n");

  const intro = pillar.heroEyebrow
    ? `<p><strong>${escapeHtml(pillar.heroEyebrow)}:</strong> ${escapeHtml(pillar.summary)}</p>`
    : `<p>${escapeHtml(pillar.summary)}</p>`;
  const body = sanitizeArticleHtml(`${intro}\n${sections}`);

  return {
    title: pillar.title,
    slug: pillar.slug,
    body,
    draftBody: body,
    excerpt: truncate(pillar.summary, 240),
    summary: truncate(pillar.summary, 280),
    postType: "pillar_page",
    category: "guides",
    primaryCategory: "guides",
    categories: ["guides"],
    tags: ["pillar", pillar.slug],
    keywords: [pillar.slug.replace(/-/g, " "), pillar.title],
    metaTitle: pillar.title,
    metaDescription: truncate(pillar.summary, 160),
    canonicalPath: `/${pillar.slug}`,
    sourcePath: `/guides/${pillar.slug}`,
    legacyPaths: [`/guides/${pillar.slug}`],
  };
}

export function buildComparisonSlugs(competitorSlug: string) {
  return {
    alternativeSlug: `${competitorSlug}-alternative`,
    vsSlug: `blogbat-vs-${competitorSlug}`,
  } as const;
}

function renderProsCons(title: string, prosCons: CompetitorProsCons): string {
  const pros = prosCons.pros
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const cons = prosCons.cons
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <h3>Pros</h3>
      <ul>${pros}</ul>
      <h3>Cons</h3>
      <ul>${cons}</ul>
    </section>
  `;
}

function renderPricingTable(competitor: Competitor): string {
  const rows = competitor.pricingTiers
    .map(
      (tier) => `
        <tr>
          <td>${escapeHtml(tier.name)}</td>
          <td>${escapeHtml(tier.monthlyPrice)}</td>
          <td>${escapeHtml(tier.summary)}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <section>
      <h2>${escapeHtml(competitor.name)} pricing snapshot</h2>
      <table>
        <thead>
          <tr><th>Plan</th><th>Price</th><th>Summary</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderFeatureMatrix(competitor: Competitor): string {
  const rows = competitor.featureMatrixRow
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.feature)}</td>
          <td>${escapeHtml(row.blogbat)}</td>
          <td>${escapeHtml(row.competitor)}</td>
          <td>${escapeHtml(row.notes ?? "")}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <section>
      <h2>Feature comparison</h2>
      <table>
        <thead>
          <tr><th>Feature</th><th>BlogBat</th><th>${escapeHtml(
            competitor.name,
          )}</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

export function buildAlternativeArticleInput(
  competitor: Competitor,
  narrative: CompetitorNarrativeInput,
  blogbatProsCons: CompetitorProsCons,
): LegacyArticleDraft {
  const slug = buildComparisonSlugs(competitor.slug).alternativeSlug;
  const body = sanitizeArticleHtml(`
    <p>${escapeHtml(narrative.tldr)}</p>
    <section>
      <h2>When BlogBat is the better fit</h2>
      <p>${escapeHtml(narrative.chooseBlogBatIf)}</p>
    </section>
    <section>
      <h2>When ${escapeHtml(competitor.name)} is the better fit</h2>
      <p>${escapeHtml(narrative.chooseCompetitorIf)}</p>
    </section>
    ${renderFeatureMatrix(competitor)}
    ${renderPricingTable(competitor)}
    ${renderProsCons("BlogBat strengths and tradeoffs", blogbatProsCons)}
    ${renderProsCons(`${competitor.name} strengths and tradeoffs`, competitor.prosCons)}
    ${buildFaqBlockHtml(narrative.faqs)}
  `);

  return {
    title: `BlogBat vs ${competitor.name}: Which Website Builder Should You Pick?`,
    slug,
    body,
    draftBody: body,
    excerpt: truncate(narrative.tldr, 240),
    summary: truncate(narrative.tldr, 280),
    postType: "comparison",
    category: "web-builders",
    primaryCategory: "web-builders",
    categories: ["web-builders"],
    tags: ["comparison", competitor.slug, "alternative"],
    keywords: [
      `${competitor.name} alternative`,
      `alternative to ${competitor.name}`,
      `blogbat vs ${competitor.name}`,
    ],
    metaTitle: `BlogBat vs ${competitor.name}: which website builder should you pick?`,
    metaDescription: truncate(
      `Honest ${competitor.name} alternative comparison with pricing, features, and the cases where ${competitor.name} is still the better choice.`,
      160,
    ),
    canonicalPath: `/${slug}`,
    sourcePath: `/alternatives/${competitor.slug}`,
    legacyPaths: [`/alternatives/${competitor.slug}`],
  };
}

export function buildVsArticleInput(
  competitor: Competitor,
  narrative: CompetitorNarrativeInput,
): LegacyArticleDraft {
  const slug = buildComparisonSlugs(competitor.slug).vsSlug;
  const body = sanitizeArticleHtml(`
    <p>${escapeHtml(narrative.tldr)}</p>
    ${renderFeatureMatrix(competitor)}
    ${renderPricingTable(competitor)}
    <section>
      <h2>Who should choose BlogBat</h2>
      <p>${escapeHtml(narrative.chooseBlogBatIf)}</p>
    </section>
    <section>
      <h2>Who should choose ${escapeHtml(competitor.name)}</h2>
      <p>${escapeHtml(narrative.chooseCompetitorIf)}</p>
    </section>
  `);

  return {
    title: `BlogBat vs ${competitor.name} Head-to-Head`,
    slug,
    body,
    draftBody: body,
    excerpt: truncate(narrative.tldr, 240),
    summary: truncate(narrative.tldr, 280),
    postType: "comparison",
    category: "web-builders",
    primaryCategory: "web-builders",
    categories: ["web-builders"],
    tags: ["comparison", competitor.slug, "vs"],
    keywords: [`blogbat vs ${competitor.name}`, `${competitor.name} vs blogbat`],
    metaTitle: `BlogBat vs ${competitor.name} -- head-to-head`,
    metaDescription: truncate(
      `Quick head-to-head comparison of BlogBat and ${competitor.name}: pricing, features, and the short answer on which tool fits which kind of small business.`,
      160,
    ),
    canonicalPath: `/${slug}`,
    sourcePath: `/vs/${competitor.slug}`,
    legacyPaths: [`/vs/${competitor.slug}`],
  };
}

export function buildAlternativesHubArticleInput(
  competitors: Competitor[],
): LegacyArticleDraft {
  const listItems = competitors
    .map((competitor) => {
      const { alternativeSlug, vsSlug } = buildComparisonSlugs(competitor.slug);
      return `
        <li>
          <strong>${escapeHtml(competitor.name)}</strong>: ${escapeHtml(competitor.bestFor)}
          <ul>
            <li><a href="/${alternativeSlug}">${escapeHtml(competitor.name)} alternative</a></li>
            <li><a href="/${vsSlug}">BlogBat vs ${escapeHtml(competitor.name)}</a></li>
          </ul>
        </li>
      `;
    })
    .join("");

  const body = sanitizeArticleHtml(`
    <p>These comparison pages are written for small business owners who are evaluating website builders and want a direct answer on pricing, fit, and tradeoffs.</p>
    <section>
      <h2>Available comparisons</h2>
      <ul>${listItems}</ul>
    </section>
  `);

  return {
    title: "BlogBat Alternatives and Comparisons",
    slug: "blogbat-alternatives",
    body,
    draftBody: body,
    excerpt:
      "Browse BlogBat alternatives and head-to-head website builder comparisons for small business owners.",
    summary:
      "Browse BlogBat alternatives and head-to-head website builder comparisons for small business owners who want a faster way to evaluate pricing, fit, and tradeoffs.",
    postType: "comparison",
    category: "web-builders",
    primaryCategory: "web-builders",
    categories: ["web-builders"],
    tags: ["comparison", "alternatives", "website-builders"],
    keywords: ["blogbat alternatives", "website builder comparisons"],
    metaTitle: "BlogBat alternatives and comparisons",
    metaDescription:
      "Honest comparisons between BlogBat and other small business website builders, including pricing, features, and who each tool fits best.",
    canonicalPath: "/blogbat-alternatives",
    sourcePath: "/alternatives",
    legacyPaths: ["/alternatives"],
  };
}
