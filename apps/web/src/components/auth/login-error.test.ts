import { describe, it, expect } from "vitest";

import { magicLinkErrorMessage } from "./login-error";

describe("magicLinkErrorMessage", () => {
  it("maps the allowlist FORBIDDEN code to a friendly message", () => {
    expect(
      magicLinkErrorMessage({ code: "THIS_EMAIL_DOMAIN_IS_NOT_PERMITTED_TO_SIGN_IN" }),
    ).toBe("This email isn't permitted to sign in.");
  });
  it("maps a 403 status to the same friendly message", () => {
    expect(magicLinkErrorMessage({ status: 403 })).toBe(
      "This email isn't permitted to sign in.",
    );
  });
  it("falls back to a generic message otherwise", () => {
    expect(magicLinkErrorMessage({ status: 500 })).toBe(
      "Couldn't send the magic link. Please try again.",
    );
    expect(magicLinkErrorMessage(undefined)).toBe(
      "Couldn't send the magic link. Please try again.",
    );
  });
});
