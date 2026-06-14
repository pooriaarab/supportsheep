import { describe, expect, it } from "vitest";
import {
  appendChatTurn,
  CHAT_TURNS_MAX_ENTRIES,
  type ChatTurn,
} from "./chat-turns";

describe("appendChatTurn", () => {
  it("appends a new turn to the end of the list", () => {
    const next = appendChatTurn([], {
      role: "user",
      text: "Refine the intro",
      timestamp: 1_700_000_000_000,
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      role: "user",
      text: "Refine the intro",
      timestamp: 1_700_000_000_000,
    });
    expect(next[0].id).toBeTypeOf("string");
  });

  it("preserves ordering across alternating user and AI turns", () => {
    let log: ChatTurn[] = [];
    log = appendChatTurn(log, {
      role: "user",
      text: "Why is the canvas empty?",
      timestamp: 1,
    });
    log = appendChatTurn(log, {
      role: "ai",
      text: "I am erroring on tool dispatch.",
      timestamp: 2,
    });
    log = appendChatTurn(log, {
      role: "user",
      text: "Try again.",
      timestamp: 3,
    });
    expect(log.map((t) => t.role)).toEqual(["user", "ai", "user"]);
    expect(log.map((t) => t.text)).toEqual([
      "Why is the canvas empty?",
      "I am erroring on tool dispatch.",
      "Try again.",
    ]);
  });

  it("trims whitespace and drops blank turns without changing the array reference", () => {
    const existing: ChatTurn[] = [];
    const sameRef = appendChatTurn(existing, {
      role: "ai",
      text: "   ",
      timestamp: 1,
    });
    expect(sameRef).toBe(existing);
  });

  it("caps the list at CHAT_TURNS_MAX_ENTRIES by dropping the oldest entries", () => {
    let log: ChatTurn[] = [];
    for (let i = 0; i < CHAT_TURNS_MAX_ENTRIES + 5; i++) {
      log = appendChatTurn(log, {
        role: i % 2 === 0 ? "user" : "ai",
        text: `turn ${i}`,
        timestamp: i,
      });
    }
    expect(log).toHaveLength(CHAT_TURNS_MAX_ENTRIES);
    // The newest entry must be retained at the end.
    expect(log[log.length - 1].text).toBe(`turn ${CHAT_TURNS_MAX_ENTRIES + 4}`);
    // The very first entries fell off the head.
    expect(log[0].text).toBe(`turn ${5}`);
  });

  it("assigns each appended turn a distinct id even within the same millisecond", () => {
    let log: ChatTurn[] = [];
    log = appendChatTurn(log, { role: "user", text: "one", timestamp: 1 });
    log = appendChatTurn(log, { role: "user", text: "two", timestamp: 1 });
    expect(log[0].id).not.toBe(log[1].id);
  });
});
