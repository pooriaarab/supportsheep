import { describe, expect, it } from "vitest";
import { extractFaqEntries } from "@/components/public/article-page";
import {
  buildFaqBlockHtml,
  buildFaqBlockHtmlRich,
} from "@/lib/faq-html/build-faq-block";

describe("buildFaqBlockHtml", () => {
  it("produces HTML that round-trips through extractFaqEntries", () => {
    const faqs = [
      { question: "What is BlogBat?", answer: "BlogBat is an AI website builder." },
      { question: "Is it free?", answer: "Yes, the starter plan is free." },
    ];
    const html = buildFaqBlockHtml(faqs);
    expect(extractFaqEntries(html)).toEqual(faqs);
  });

  it("escapes HTML entities in questions and answers", () => {
    const faqs = [
      { question: `What about <script> & "quotes"?`, answer: `Use & escape < and >.` },
    ];
    const html = buildFaqBlockHtml(faqs);
    // Must not introduce a real <script> tag in the output.
    expect(html).not.toMatch(/<script>/);
    // Escaped `&lt;script&gt;` decodes back to "<script>" as plaintext — no real tag ever emitted.
    expect(extractFaqEntries(html)).toEqual([
      { question: `What about <script> & "quotes"?`, answer: `Use & escape < and >.` },
    ]);
  });

  it("returns empty string for empty input", () => {
    expect(buildFaqBlockHtml([])).toBe("");
  });
});

describe("buildFaqBlockHtmlRich", () => {
  it("produces HTML that round-trips through extractFaqEntries for rich answers", () => {
    const faqs = [
      {
        question: "What is BlogBat?",
        answerHtml:
          "<p>BlogBat is an AI website builder.</p><ul><li>Fast</li><li>Cheap</li></ul><blockquote>Trusted by thousands.</blockquote>",
      },
    ];
    const html = buildFaqBlockHtmlRich(faqs);
    // Closing block tags become spaces in stripTags; opening tags are removed
    // without adding whitespace. After collapse + trim the answer reads as a
    // single run of the inner text.
    expect(extractFaqEntries(html)).toEqual([
      {
        question: "What is BlogBat?",
        answer: "BlogBat is an AI website builder. Fast Cheap Trusted by thousands.",
      },
    ]);
  });

  it("escapes the question but preserves answer HTML verbatim", () => {
    const faqs = [
      { question: "What about <x>?", answerHtml: "<p>Valid HTML.</p>" },
    ];
    const html = buildFaqBlockHtmlRich(faqs);
    expect(html).toContain("&lt;x&gt;");
    expect(html).not.toMatch(/<h3 class="faq-question">[^<]*<x>/);
    expect(html).toContain(`<div class="faq-answer"><p>Valid HTML.</p></div>`);
  });
});
