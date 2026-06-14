import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MagicLinkForm } from "../components/magic-link-form";
import React from "react";

describe("MagicLinkForm", () => {
  it("renders email field correctly", () => {
    const html = renderToStaticMarkup(
      <MagicLinkForm token="test-token-12345678901234567890123456789012" />
    );

    expect(html).toContain("Your Email Address");
    expect(html).toContain('placeholder="you@example.com"');
    expect(html).toContain("Send magic link");
  });
});
