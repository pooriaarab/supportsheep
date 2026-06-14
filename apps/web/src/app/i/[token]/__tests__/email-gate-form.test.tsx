import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailGateForm } from "../components/email-gate-form";
import React from "react";

describe("EmailGateForm", () => {
  it("renders email and name fields correctly", () => {
    const html = renderToStaticMarkup(
      <EmailGateForm token="test-token-12345678901234567890123456789012" />
    );

    expect(html).toContain("Your Name");
    expect(html).toContain('placeholder="Jane Doe"');
    expect(html).toContain("Your Email");
    expect(html).toContain('placeholder="jane@example.com"');
    expect(html).toContain("Continue to interview");
  });
});
