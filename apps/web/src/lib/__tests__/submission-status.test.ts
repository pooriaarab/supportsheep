import { describe, expect, it } from "vitest";
import { getIndexNowStatusLabel } from "@/lib/seo/submission-status";

describe("getIndexNowStatusLabel", () => {
  it("formats submitted status for the UI", () => {
    expect(getIndexNowStatusLabel("submitted")).toBe("Submitted");
  });

  it("formats missing config as not configured", () => {
    expect(getIndexNowStatusLabel("not_configured")).toBe("Not configured");
    expect(getIndexNowStatusLabel(undefined)).toBe("Not configured");
  });
});
