import { describe, expect, it } from "vitest";
import {
  ShareLinkCreateInput,
  ShareLinkUpdateInput,
} from "./share-link-schema";

describe("ShareLinkCreateInput", () => {
  it("should validate and apply defaults for a minimal valid object", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "link",
    });

    expect(parsed).toEqual({
      type: "link",
      style: "smart",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      maxUses: null,
      language: "en",
      mode: "live",
    });
  });

  it("should accept valid custom values", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "private",
      topic: "My Topic",
      goal: "My Goal",
      style: "eeat",
      authMode: "email",
      recordingConfig: "audio",
      maxDurationSec: 600,
      expiresAt: "2026-05-19T12:00:00.000Z",
      maxUses: 10,
      language: "es",
    });

    expect(parsed).toEqual({
      type: "private",
      topic: "My Topic",
      goal: "My Goal",
      style: "eeat",
      authMode: "email",
      recordingConfig: "audio",
      maxDurationSec: 600,
      expiresAt: "2026-05-19T12:00:00.000Z",
      maxUses: 10,
      language: "es",
      mode: "live",
    });
  });

  it("should accept video as recordingConfig", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "link",
      recordingConfig: "video",
    });
    expect(parsed.recordingConfig).toBe("video");
  });

  it("should reject invalid enums", () => {
    const result = ShareLinkCreateInput.safeParse({
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid languages", () => {
    const result = ShareLinkCreateInput.safeParse({
      type: "link",
      language: "invalid_lang",
    });
    expect(result.success).toBe(false);
  });

  it("should enforce maxDurationSec <= 1800", () => {
    const valid = ShareLinkCreateInput.safeParse({
      type: "link",
      maxDurationSec: 1800,
    });
    expect(valid.success).toBe(true);

    const invalid = ShareLinkCreateInput.safeParse({
      type: "link",
      maxDurationSec: 1801,
    });
    expect(invalid.success).toBe(false);
  });

  it("should reject non-ISO datetime strings for expiresAt", () => {
    const invalid = ShareLinkCreateInput.safeParse({
      type: "link",
      expiresAt: "invalid-date",
    });
    expect(invalid.success).toBe(false);
  });

  it("should accept valid scheduledAt and scheduledGuestEmail", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "link",
      scheduledAt: "2026-06-01T10:00:00.000Z",
      scheduledGuestEmail: "guest@example.com",
    });
    expect(parsed.scheduledAt).toBe("2026-06-01T10:00:00.000Z");
    expect(parsed.scheduledGuestEmail).toBe("guest@example.com");
  });

  it("should reject non-ISO datetime strings for scheduledAt", () => {
    const invalid = ShareLinkCreateInput.safeParse({
      type: "link",
      scheduledAt: "invalid-date",
    });
    expect(invalid.success).toBe(false);
  });

  it("should reject invalid emails for scheduledGuestEmail", () => {
    const invalid = ShareLinkCreateInput.safeParse({
      type: "link",
      scheduledGuestEmail: "invalid-email",
    });
    expect(invalid.success).toBe(false);
  });

  it("should default mode to live", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "link",
    });
    expect(parsed.mode).toBe("live");
  });

  it("should accept mode async and valid asyncQuestions", () => {
    const parsed = ShareLinkCreateInput.parse({
      type: "link",
      mode: "async",
      asyncQuestions: [
        {
          id: "q1",
          text: "What is your name?",
          audioStoragePath: "share-links/123/questions/q1.webm",
        },
      ],
    });
    expect(parsed.mode).toBe("async");
    expect(parsed.asyncQuestions).toEqual([
      {
        id: "q1",
        text: "What is your name?",
        audioStoragePath: "share-links/123/questions/q1.webm",
      },
    ]);
  });

  it("should reject more than 20 asyncQuestions", () => {
    const questions = Array.from({ length: 21 }, (_, i) => ({
      id: `q${i}`,
      text: `Question ${i}`,
      audioStoragePath: `share-links/123/questions/q${i}.webm`,
    }));

    const result = ShareLinkCreateInput.safeParse({
      type: "link",
      mode: "async",
      asyncQuestions: questions,
    });
    expect(result.success).toBe(false);
  });
});

describe("ShareLinkUpdateInput", () => {
  it("should accept partial updates", () => {
    const parsed = ShareLinkUpdateInput.parse({
      topic: "Updated Topic",
      language: "fr",
    });
    expect(parsed).toEqual({
      topic: "Updated Topic",
      language: "fr",
    });
  });

  it("should reject updates to immutable fields (type, authMode, recordingConfig)", () => {
    const invalidType = ShareLinkUpdateInput.safeParse({
      type: "workspace",
    });
    expect(invalidType.success).toBe(false);

    const invalidAuthMode = ShareLinkUpdateInput.safeParse({
      authMode: "magic_link",
    });
    expect(invalidAuthMode.success).toBe(false);

    const invalidRecording = ShareLinkUpdateInput.safeParse({
      recordingConfig: "audio",
    });
    expect(invalidRecording.success).toBe(false);
  });
});
