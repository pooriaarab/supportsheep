import { describe, expect, it } from "vitest";

import { buildInstructions } from "./instructions";

describe("buildInstructions", () => {
  it("includes the CNAME step", () => {
    const steps = buildInstructions("blog.example.com", "abc.cname.blogbat.com");
    expect(steps[0]).toContain("blog.example.com");
    expect(steps).toContainEqual(
      "Add a CNAME record: blog.example.com → abc.cname.blogbat.com",
    );
  });

  it("adds the ownership-verification TXT step when provided", () => {
    const steps = buildInstructions("blog.example.com", "abc.cname.blogbat.com", {
      type: "txt",
      name: "_cf-custom-hostname.blog.example.com",
      value: "token-123",
    });
    expect(steps).toContainEqual(
      "Add an ownership-verification TXT record: _cf-custom-hostname.blog.example.com → token-123",
    );
  });

  it("omits the ownership-verification step when absent", () => {
    const withoutOv = buildInstructions("blog.example.com", "x.blogbat.com");
    const withNull = buildInstructions("blog.example.com", "x.blogbat.com", null);
    for (const steps of [withoutOv, withNull]) {
      expect(steps.some((s) => s.includes("ownership-verification"))).toBe(false);
    }
  });

  it("always includes the host-field doubled-record caveat", () => {
    const steps = buildInstructions("blog.example.com", "x.blogbat.com", {
      type: "txt",
      name: "_cf-custom-hostname.blog.example.com",
      value: "token",
    });
    const caveat = steps.find((s) => s.includes("auto-append"));
    expect(caveat).toBeDefined();
    expect(caveat).toContain("doubled record");
    expect(caveat).toContain("before your domain");
  });

  it("ends with the save-and-recheck step", () => {
    const steps = buildInstructions("blog.example.com", "x.blogbat.com");
    expect(steps[steps.length - 1]).toContain("check status");
  });
});
