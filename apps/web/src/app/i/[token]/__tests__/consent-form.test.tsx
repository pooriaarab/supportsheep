import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentForm } from "../consent/components/consent-form";
import React from "react";

describe("ConsentForm", () => {
  it("renders with audio consent details when recordingConfig is audio", () => {
    const html = renderToStaticMarkup(
      <ConsentForm
        token="test-token-12345678901234567890123456789012"
        interviewId="interview-123"
        recordingConfig="audio"
        topic="SaaS Strategy"
        maxDurationSec={900}
      />
    );

    expect(html).toContain("Consent and Privacy Agreement");
    expect(html).toContain("SaaS Strategy");
    expect(html).toContain("15 minutes");
    expect(html).toContain("Audio &amp; Transcript Recording");
    expect(html).toContain("recording of your voice");
    expect(html).toContain("Decline");
    expect(html).toContain("Accept &amp; Start");
  });

  it("renders with transcript-only details when recordingConfig is transcript", () => {
    const html = renderToStaticMarkup(
      <ConsentForm
        token="test-token-12345678901234567890123456789012"
        interviewId="interview-123"
        recordingConfig="transcript"
        topic="SaaS Strategy"
        maxDurationSec={900}
      />
    );

    expect(html).toContain("Transcript Only");
    expect(html).not.toContain("recording of your voice");
    expect(html).toContain("consent to the generation of a text transcript");
  });

  it("renders with video & transcript details when recordingConfig is video", () => {
    const html = renderToStaticMarkup(
      <ConsentForm
        token="test-token-12345678901234567890123456789012"
        interviewId="interview-123"
        recordingConfig="video"
        topic="SaaS Video Strategy"
        maxDurationSec={900}
      />
    );

    expect(html).toContain("Video &amp; Transcript Recording");
    expect(html).toContain("recording of your video and audio input");
  });
});
