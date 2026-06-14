/**
 * SEO Scoring Engine
 *
 * Client-side scoring (0-100) based on content and metadata analysis.
 * Each metric is scored individually and combined into a weighted total.
 */

import type { PostType } from "@repo/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type MetricStatus = "good" | "warning" | "poor";

export interface SeoMetric {
  id: string;
  label: string;
  status: MetricStatus;
  score: number;
  maxScore: number;
  detail: string;
  suggestion: string | null;
}

export interface SeoScoreResult {
  total: number;
  metrics: SeoMetric[];
}

interface ScoringInput {
  body: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  postType: PostType;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const WORD_COUNT_TARGETS: Record<PostType, number> = {
  blog_post: 1000,
  listicle: 1200,
  how_to: 1500,
  comparison: 1500,
  product_review: 1200,
  pillar_page: 2500,
  glossary: 500,
  landing_page: 600,
};

function countWords(text: string): number {
  const stripped = text
    .replace(/<[^>]*>/g, "")
    .replace(/[#*_~`>|\-[\]()]/g, " ");
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function countPattern(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

function metricStatus(score: number, max: number): MetricStatus {
  const ratio = score / max;
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.4) return "warning";
  return "poor";
}

/* -------------------------------------------------------------------------- */
/* Individual Metrics                                                          */
/* -------------------------------------------------------------------------- */

function scoreWordCount(body: string, postType: PostType): SeoMetric {
  const count = countWords(body);
  const target = WORD_COUNT_TARGETS[postType] ?? 1000;
  const maxScore = 20;

  let score: number;
  if (count >= target) {
    score = maxScore;
  } else if (count >= target * 0.5) {
    score = Math.round(maxScore * (count / target));
  } else {
    score = Math.round(maxScore * 0.2 * (count / (target * 0.5)));
  }
  score = Math.min(score, maxScore);

  return {
    id: "word-count",
    label: "Word Count",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `${count} / ${target}+ words`,
    suggestion:
      count < target
        ? `Add ${target - count} more words to reach the target.`
        : null,
  };
}

function scoreKeywordDensity(body: string, keywords: string[]): SeoMetric {
  const maxScore = 15;

  if (keywords.length === 0) {
    return {
      id: "keyword-density",
      label: "Keyword Density",
      status: "poor",
      score: 0,
      maxScore,
      detail: "No keywords set",
      suggestion: "Add target keywords in the metadata panel.",
    };
  }

  const wordCount = countWords(body);
  if (wordCount === 0) {
    return {
      id: "keyword-density",
      label: "Keyword Density",
      status: "poor",
      score: 0,
      maxScore,
      detail: "No content yet",
      suggestion: "Start writing content to calculate keyword density.",
    };
  }

  const lowerBody = body.toLowerCase();
  const primaryKeyword = keywords[0].toLowerCase();
  const occurrences = countPattern(
    lowerBody,
    new RegExp(
      `\\b${primaryKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    ),
  );
  const density = (occurrences / wordCount) * 100;

  let score: number;
  if (density >= 0.8 && density <= 2.5) {
    score = maxScore;
  } else if (density > 0 && density < 0.8) {
    score = Math.round(maxScore * (density / 0.8));
  } else if (density > 2.5 && density <= 4) {
    score = Math.round(maxScore * (1 - (density - 2.5) / 1.5));
  } else {
    score = density > 0 ? Math.round(maxScore * 0.2) : 0;
  }
  score = Math.max(0, Math.min(score, maxScore));

  return {
    id: "keyword-density",
    label: "Keyword Density",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `"${keywords[0]}" appears ${occurrences}x (${density.toFixed(1)}%)`,
    suggestion:
      density < 0.8
        ? "Use your primary keyword more often in the content."
        : density > 2.5
          ? "Reduce keyword usage to avoid keyword stuffing."
          : null,
  };
}

function scoreHeadings(body: string): SeoMetric {
  const maxScore = 10;
  const h2Count = countPattern(body, /^#{2}\s|<h2[\s>]/gm);

  let score: number;
  if (h2Count >= 2) {
    score = maxScore;
  } else if (h2Count === 1) {
    score = Math.round(maxScore * 0.6);
  } else {
    score = 0;
  }

  return {
    id: "headings",
    label: "Headings (H2)",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `${h2Count} H2 heading${h2Count !== 1 ? "s" : ""} found`,
    suggestion:
      h2Count < 2
        ? "Add at least 2 H2 headings to structure your content."
        : null,
  };
}

function scoreInternalLinks(body: string): SeoMetric {
  const maxScore = 10;
  // Match markdown links and HTML anchors, look for relative URLs (internal)
  const allLinks = countPattern(
    body,
    /\[([^\]]*)\]\(([^)]*)\)|<a\s[^>]*href="([^"]*)"[^>]*>/g,
  );
  const externalLinks = countPattern(
    body,
    /\[([^\]]*)\]\(https?:\/\/|<a\s[^>]*href="https?:\/\//g,
  );
  const internalCount = Math.max(0, allLinks - externalLinks);

  let score: number;
  if (internalCount >= 2) {
    score = maxScore;
  } else if (internalCount === 1) {
    score = Math.round(maxScore * 0.5);
  } else {
    score = 0;
  }

  return {
    id: "internal-links",
    label: "Internal Links",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `${internalCount} internal link${internalCount !== 1 ? "s" : ""} found`,
    suggestion:
      internalCount < 2
        ? "Add at least 2 internal links to related content."
        : null,
  };
}

function scoreExternalLinks(body: string): SeoMetric {
  const maxScore = 5;
  const count = countPattern(
    body,
    /\[([^\]]*)\]\(https?:\/\/|<a\s[^>]*href="https?:\/\//g,
  );

  const score = count >= 1 ? maxScore : 0;

  return {
    id: "external-links",
    label: "External Links",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `${count} external link${count !== 1 ? "s" : ""} found`,
    suggestion:
      count < 1 ? "Add at least 1 external link to a credible source." : null,
  };
}

function scoreImages(body: string): SeoMetric {
  const maxScore = 10;
  const imageCount = countPattern(body, /!\[([^\]]*)\]\(|<img\s/g);
  const altCount = countPattern(body, /!\[[^\]]+\]\(|<img\s[^>]*alt="[^"]+"/g);

  let score: number;
  if (imageCount >= 1 && altCount >= imageCount) {
    score = maxScore;
  } else if (imageCount >= 1) {
    score = Math.round(maxScore * 0.6);
  } else {
    score = 0;
  }

  return {
    id: "images",
    label: "Images",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: `${imageCount} image${imageCount !== 1 ? "s" : ""}, ${altCount} with alt text`,
    suggestion:
      imageCount === 0
        ? "Add at least 1 image to your content."
        : altCount < imageCount
          ? "Add alt text to all images for accessibility and SEO."
          : null,
  };
}

function scoreMetaTitle(metaTitle: string): SeoMetric {
  const maxScore = 15;
  const len = metaTitle.length;

  let score: number;
  if (len >= 50 && len <= 60) {
    score = maxScore;
  } else if (len >= 30 && len < 50) {
    score = Math.round(maxScore * 0.7);
  } else if (len > 60 && len <= 70) {
    score = Math.round(maxScore * 0.7);
  } else if (len > 0) {
    score = Math.round(maxScore * 0.3);
  } else {
    score = 0;
  }

  return {
    id: "meta-title",
    label: "Meta Title",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: len > 0 ? `${len} characters (ideal: 50-60)` : "Not set",
    suggestion:
      len === 0
        ? "Add a meta title for better search engine visibility."
        : len < 50
          ? "Make your meta title longer (aim for 50-60 characters)."
          : len > 60
            ? "Shorten your meta title (aim for 50-60 characters)."
            : null,
  };
}

function scoreMetaDescription(metaDescription: string): SeoMetric {
  const maxScore = 15;
  const len = metaDescription.length;

  let score: number;
  if (len >= 150 && len <= 160) {
    score = maxScore;
  } else if (len >= 120 && len < 150) {
    score = Math.round(maxScore * 0.7);
  } else if (len > 160 && len <= 180) {
    score = Math.round(maxScore * 0.7);
  } else if (len > 0) {
    score = Math.round(maxScore * 0.3);
  } else {
    score = 0;
  }

  return {
    id: "meta-description",
    label: "Meta Description",
    status: metricStatus(score, maxScore),
    score,
    maxScore,
    detail: len > 0 ? `${len} characters (ideal: 150-160)` : "Not set",
    suggestion:
      len === 0
        ? "Add a meta description for better click-through rates."
        : len < 150
          ? "Make your meta description longer (aim for 150-160 characters)."
          : len > 160
            ? "Shorten your meta description (aim for 150-160 characters)."
            : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Main scoring function                                                       */
/* -------------------------------------------------------------------------- */

export function calculateSeoScore(input: ScoringInput): SeoScoreResult {
  const metrics: SeoMetric[] = [
    scoreWordCount(input.body, input.postType),
    scoreKeywordDensity(input.body, input.keywords),
    scoreHeadings(input.body),
    scoreInternalLinks(input.body),
    scoreExternalLinks(input.body),
    scoreImages(input.body),
    scoreMetaTitle(input.metaTitle),
    scoreMetaDescription(input.metaDescription),
  ];

  const total = metrics.reduce((sum, m) => sum + m.score, 0);

  return { total, metrics };
}
