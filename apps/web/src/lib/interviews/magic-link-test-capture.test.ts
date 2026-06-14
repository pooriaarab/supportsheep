import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMagicLinkCaptures,
  getLatestMagicLinkUrlFor,
  isMagicLinkTestCaptureEnabled,
  recordMagicLinkUrl,
} from "./magic-link-test-capture";

describe("magic-link-test-capture", () => {
  beforeEach(() => {
    clearMagicLinkCaptures();
    vi.stubEnv("INTERVIEW_MAGIC_LINK_TEST_CAPTURE", "");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when env flag is unset", () => {
    expect(isMagicLinkTestCaptureEnabled()).toBe(false);
  });

  it("is enabled when env flag is true and node env is not production", () => {
    vi.stubEnv("INTERVIEW_MAGIC_LINK_TEST_CAPTURE", "true");
    expect(isMagicLinkTestCaptureEnabled()).toBe(true);
  });

  it("is always disabled in production regardless of flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERVIEW_MAGIC_LINK_TEST_CAPTURE", "true");
    expect(isMagicLinkTestCaptureEnabled()).toBe(false);
  });

  it("records and reads back the latest URL for an email", () => {
    recordMagicLinkUrl("Guest@Example.com", "https://example.com/first");
    recordMagicLinkUrl("guest@example.com", "https://example.com/second");

    const captured = getLatestMagicLinkUrlFor("GUEST@example.com");
    expect(captured).not.toBeNull();
    expect(captured?.url).toBe("https://example.com/second");
    expect(typeof captured?.capturedAt).toBe("number");
  });

  it("returns null for unknown emails", () => {
    expect(getLatestMagicLinkUrlFor("nobody@example.com")).toBeNull();
  });

  it("clears all captures", () => {
    recordMagicLinkUrl("a@example.com", "https://example.com/a");
    clearMagicLinkCaptures();
    expect(getLatestMagicLinkUrlFor("a@example.com")).toBeNull();
  });
});
