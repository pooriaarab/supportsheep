import { describe, expect, it } from "vitest";
import { generateInterviewIcs } from "./ics";

describe("generateInterviewIcs", () => {
  it("should generate a valid RFC 5545 ICS string", () => {
    const ics = generateInterviewIcs({
      token: "test_token_1234567890_abcdefghijklm",
      topic: "Awesome AI Feature Discussion",
      scheduledAt: "2026-06-01T10:00:00.000Z",
      durationSec: 900, // 15 mins
      baseUrl: "https://blogbat.com",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//BlogBat//Interview Calendar//EN");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:interview-token-test_token_1234567890_abcdefghijklm@blogbat.com");
    expect(ics).toContain("DTSTART:20260601T100000Z");
    expect(ics).toContain("DTEND:20260601T101500Z"); // +15 mins
    expect(ics).toContain("SUMMARY:BlogBat AI Interview: Awesome AI Feature Discussion");
    expect(ics).toContain("URL:https://blogbat.com/i/test_token_1234567890_abcdefghijklm");
    expect(ics).toContain("DESCRIPTION:Your BlogBat AI interview is scheduled.\\n\\nJoin here: https://blogbat.com/i/test_token_1234567890_abcdefghijklm");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("should escape special characters in summary and description", () => {
    const ics = generateInterviewIcs({
      token: "token123",
      topic: "Topic; with, special\\ chars",
      scheduledAt: "2026-06-01T10:00:00.000Z",
      durationSec: 300,
      baseUrl: "https://blogbat.com",
    });

    expect(ics).toContain("SUMMARY:BlogBat AI Interview: Topic\\; with\\, special\\\\ chars");
  });
});
