import { describe, expect, it } from "vitest";
import {
  AI_DISCLOSURE_HTML,
  AI_DISCLOSURE_TEXT,
  prependAiDisclosure,
  stripLeadingAiDisclosure,
} from "@/lib/articles/prepend-ai-disclosure";

describe("prependAiDisclosure", () => {
  it("prepends disclosure above a TL;DR opener", () => {
    const body = "<p><strong>TL;DR:</strong> Quick summary.</p><p>Rest.</p>";

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body: `${AI_DISCLOSURE_HTML}${body}`,
      changed: true,
    });
  });

  it("prepends disclosure above a non-TL;DR opener", () => {
    const body = "<p>First paragraph.</p><p>Second paragraph.</p>";

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body: `${AI_DISCLOSURE_HTML}${body}`,
      changed: true,
    });
  });

  it("skips when disclosure already exists first with whitespace tolerance", () => {
    const body = `<p>\n  <em>  ${AI_DISCLOSURE_TEXT}  </em>\n</p><p>Second paragraph.</p>`;

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body,
      changed: false,
    });
  });

  it("skips when first disclosure paragraph has allowed p attributes", () => {
    const body = `<p class="note" id="ai-disclosure"><em>${AI_DISCLOSURE_TEXT}</em></p><p>Second paragraph.</p>`;

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body,
      changed: false,
    });
  });

  it("skips when first disclosure paragraph has style attribute on p", () => {
    const body = `<p style="text-align:left"><em>${AI_DISCLOSURE_TEXT}</em></p><p>Second paragraph.</p>`;

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body,
      changed: false,
    });
  });

  it("skips when the disclosure em element has attributes", () => {
    const body = `<p><em class="disclosure">${AI_DISCLOSURE_TEXT}</em></p><p>Second paragraph.</p>`;

    const result = prependAiDisclosure(body);

    expect(result).toEqual({
      body,
      changed: false,
    });
  });

  it("skips empty body", () => {
    expect(prependAiDisclosure("")).toEqual({
      body: "",
      changed: false,
    });

    expect(prependAiDisclosure("   ")).toEqual({
      body: "   ",
      changed: false,
    });
  });
});

describe("stripLeadingAiDisclosure", () => {
  it("removes the first disclosure paragraph when present", () => {
    const body = `${AI_DISCLOSURE_HTML}<p>First paragraph.</p>`;

    expect(stripLeadingAiDisclosure(body)).toEqual({
      body: "<p>First paragraph.</p>",
      changed: true,
    });
  });

  it("leaves the body unchanged when the disclosure is not first", () => {
    const body = `<p>First paragraph.</p>${AI_DISCLOSURE_HTML}`;

    expect(stripLeadingAiDisclosure(body)).toEqual({
      body,
      changed: false,
    });
  });
});
