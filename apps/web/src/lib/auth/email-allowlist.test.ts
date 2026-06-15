import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmailAllowed } from "./email-allowlist";

const ENV = process.env.ALLOWED_EMAIL_DOMAINS;
afterEach(() => {
  if (ENV === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
  else process.env.ALLOWED_EMAIL_DOMAINS = ENV;
  vi.unstubAllEnvs();
});

describe("isEmailAllowed", () => {
  it("allows all when no domains are configured", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    expect(isEmailAllowed("anyone@anywhere.com")).toBe(true);
  });

  it("allows an email whose domain matches a configured suffix", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "@supportsheep.com");
    expect(isEmailAllowed("pooria@supportsheep.com")).toBe(true);
  });

  it("blocks an email whose domain does not match", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "@supportsheep.com");
    expect(isEmailAllowed("attacker@evil.test")).toBe(false);
  });

  it("is case-insensitive and tolerates spaces / multiple domains", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", " @Supportsheep.com , @acme.io ");
    expect(isEmailAllowed("USER@Supportsheep.COM")).toBe(true);
    expect(isEmailAllowed("x@acme.io")).toBe(true);
    expect(isEmailAllowed("x@other.com")).toBe(false);
  });
});
