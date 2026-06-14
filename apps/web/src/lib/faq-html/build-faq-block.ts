export interface FaqEntry {
  question: string;
  answer: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFaqBlockHtml(faqs: FaqEntry[]): string {
  if (!faqs.length) return "";
  const items = faqs
    .map(
      (f) =>
        `<div class="faq-item"><h3 class="faq-question">${escapeHtml(
          f.question,
        )}</h3><div class="faq-answer"><p>${escapeHtml(
          f.answer,
        )}</p></div></div>`,
    )
    .join("");
  return `<section class="faq" data-block="faq">${items}</section>`;
}

export interface RichFaqEntry {
  question: string;
  /** Pre-sanitized, well-formed block HTML (p/ul/ol/blockquote/etc). */
  answerHtml: string;
}

/**
 * Like {@link buildFaqBlockHtml} but answers are arbitrary well-formed HTML
 * block content instead of plaintext. Used by the prose-FAQ -> TipTap schema
 * migration to preserve existing rich answer formatting (lists, blockquotes,
 * multi-paragraph answers). The caller is responsible for sanitizing the
 * answer HTML before calling this.
 */
export function buildFaqBlockHtmlRich(faqs: RichFaqEntry[]): string {
  if (!faqs.length) return "";
  const items = faqs
    .map(
      (f) =>
        `<div class="faq-item"><h3 class="faq-question">${escapeHtml(f.question)}</h3><div class="faq-answer">${f.answerHtml}</div></div>`,
    )
    .join("");
  return `<section class="faq" data-block="faq">${items}</section>`;
}
