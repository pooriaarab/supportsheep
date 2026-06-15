import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  getDefaultSecurityHeaders,
} from "@/lib/security-headers";

describe("getDefaultSecurityHeaders", () => {
  it("allows camera and microphone for self plus Tavus/Daily.co iframes", () => {
    // Without these explicit allow-list entries the Tavus iframe inherits the
    // parent document's permissions policy and `getUserMedia` fails with
    // `NotAllowedError` even though the user has granted browser-level
    // mic/camera permission.
    const headers = getDefaultSecurityHeaders(false);
    const policy = headers.find((h) => h.key === "Permissions-Policy");
    expect(policy, "Permissions-Policy header must exist").toBeTruthy();
    const value = policy!.value;
    expect(value).toMatch(/camera=\(self/);
    expect(value).toContain('"https://*.tavus.io"');
    expect(value).toContain('"https://*.daily.co"');
    expect(value).toMatch(/microphone=\(self/);
  });

  it("denies display-capture so embedded providers cannot trigger screen-share", () => {
    const headers = getDefaultSecurityHeaders(false);
    const policy = headers.find((h) => h.key === "Permissions-Policy");
    expect(policy!.value).toContain("display-capture=()");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("allows Tavus and Daily.co iframes in frame-src so the video interview flow is not blocked", () => {
    const csp = buildContentSecurityPolicy(false);
    // Pull just the frame-src directive so we don't accidentally match the same
    // origin in connect-src (which has wss/https forms for the same hosts).
    const frameSrcMatch = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("frame-src "));
    expect(frameSrcMatch, "frame-src directive must exist").toBeTruthy();
    expect(frameSrcMatch).toContain("https://*.tavus.io");
    expect(frameSrcMatch).toContain("https://*.daily.co");
    expect(frameSrcMatch).toContain("https://tavusapi.com");
  });

  it("declares a media-src directive for self and blob sources", () => {
    const csp = buildContentSecurityPolicy(false);
    const mediaSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("media-src "));
    expect(mediaSrc, "media-src directive must exist").toBeTruthy();
    expect(mediaSrc).toContain("'self'");
    expect(mediaSrc).toContain("blob:");
  });

  it("keeps OpenAI realtime and Tavus origins in connect-src", () => {
    const csp = buildContentSecurityPolicy(false);
    const connectSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src "));
    expect(connectSrc).toContain("https://api.openai.com");
    expect(connectSrc).toContain("https://*.tavus.io");
    expect(connectSrc).toContain("https://*.daily.co");
  });

  it("allows GA4 collection origins in connect-src so the per-blog tag records hits", () => {
    const csp = buildContentSecurityPolicy(false);
    const connectSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src "));
    expect(connectSrc).toContain("https://www.google-analytics.com");
    expect(connectSrc).toContain("https://*.analytics.google.com");
  });
});
