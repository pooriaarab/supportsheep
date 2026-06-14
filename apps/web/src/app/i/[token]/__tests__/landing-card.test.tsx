import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingCard } from "../components/landing-card";
import type { ShareLinkPublicView } from "@/lib/interviews/share-link-schema";
import React from "react";

describe("LandingCard", () => {
  const baseLink: ShareLinkPublicView = {
    topic: "AI Engineering",
    goal: "Learn system designs",
    style: "smart",
    recordingConfig: "audio",
    maxDurationSec: 600,
    authMode: "anonymous",
    type: "link",
    status: "active",
  };

  it("renders anonymous join button when authMode is anonymous", () => {
    const html = renderToStaticMarkup(
      <LandingCard token="test-token-12345678901234567890123456789012" link={baseLink} />
    );

    expect(html).toContain("invited to an AI interview");
    expect(html).toContain("AI Engineering");
    expect(html).toContain("~10 minutes");
    expect(html).toContain("Audio + transcript");
    expect(html).toContain("Join interview");
  });

  it("renders email gate form when authMode is email", () => {
    const emailLink: ShareLinkPublicView = {
      ...baseLink,
      authMode: "email",
    };

    const html = renderToStaticMarkup(
      <LandingCard token="test-token-12345678901234567890123456789012" link={emailLink} />
    );

    expect(html).toContain("Your Name");
    expect(html).toContain("Your Email");
    expect(html).toContain("Continue to interview");
  });

  it("renders magic link form when authMode is magic_link", () => {
    const mlLink: ShareLinkPublicView = {
      ...baseLink,
      authMode: "magic_link",
    };

    const html = renderToStaticMarkup(
      <LandingCard token="test-token-12345678901234567890123456789012" link={mlLink} />
    );

    expect(html).toContain("Your Email Address");
    expect(html).toContain("Send magic link");
  });
});
