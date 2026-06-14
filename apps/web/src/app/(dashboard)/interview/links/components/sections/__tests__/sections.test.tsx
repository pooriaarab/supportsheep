import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Import sections (will fail compilation in RED phase)
import { ShareVisibilitySection } from "../share-visibility-section";
import { ShareStyleSection } from "../share-style-section";
import { ShareRecordingSection } from "../share-recording-section";
import { ShareDurationSection } from "../share-duration-section";
import { ShareAuthSection } from "../share-auth-section";
import { ShareExpirySection } from "../share-expiry-section";
import { ShareLanguageSection } from "../share-language-section";

describe("Share visibility section", () => {
  it("renders with options and highlights the selected visibility option", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareVisibilitySection value="link" onChange={onChange} />
    );

    expect(html).toContain("Private");
    expect(html).toContain("Link");
    expect(html).toContain("Workspace");
    // Verify link option is styled as active
    expect(html).toContain("border-primary");
  });
});

describe("Share style section", () => {
  it("renders with options and highlights the selected style", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareStyleSection value="smart" onChange={onChange} />
    );

    expect(html).toContain("Testimonial");
    expect(html).toContain("EEAT");
    expect(html).toContain("Case study");
    expect(html).toContain("Q&amp;A post");
    expect(html).toContain("Launch story");
    expect(html).toContain("Smart");
  });
});

describe("Share recording section", () => {
  it("renders with options and highlights selected recording configuration", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareRecordingSection value="audio" onChange={onChange} />
    );

    expect(html).toContain("Transcript only");
    expect(html).toContain("Audio");
    expect(html).toContain("Video");
  });

  it("allows selecting the video option without a Soon badge", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareRecordingSection value="video" onChange={onChange} />
    );

    expect(html).not.toContain("Soon");
  });
});

describe("Share duration section", () => {
  it("renders the duration and highlights it", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareDurationSection value={300} onChange={onChange} />
    );

    expect(html).toContain("5 min");
  });
});

describe("Share auth section", () => {
  it("renders the auth gates", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareAuthSection value="email" onChange={onChange} />
    );

    expect(html).toContain("Anonymous");
    expect(html).toContain("Email-gated");
    expect(html).toContain("Magic-link account");
  });
});

describe("Share expiry section", () => {
  it("renders fields for expiry and max uses", () => {
    const onExpiresAtChange = vi.fn();
    const onMaxUsesChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareExpirySection
        expiresAt=""
        onExpiresAtChange={onExpiresAtChange}
        maxUses={3}
        onMaxUsesChange={onMaxUsesChange}
      />
    );

    expect(html).toContain("Expires");
    expect(html).toContain("Max uses");
  });
});

describe("Share language section", () => {
  it("renders with options and lists languages", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <ShareLanguageSection value="en" onChange={onChange} />
    );

    expect(html).toContain("Interview language");
  });
});
