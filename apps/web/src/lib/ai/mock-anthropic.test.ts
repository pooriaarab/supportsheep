import { describe, test, expect } from "vitest";
import { createMockAnthropic } from "./mock-anthropic";

describe("createMockAnthropic", () => {
  test("messages.create returns a non-empty content block", async () => {
    const client = createMockAnthropic();
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content.length).toBeGreaterThan(0);
    const first = res.content[0];
    expect(first.type).toBe("text");
    expect((first as { text: string }).text.length).toBeGreaterThan(0);
  });

  test("returns an empty WriterDiff array when system prompt mentions WriterDiff", async () => {
    const client = createMockAnthropic();
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      system: [
        {
          type: "text",
          text: "Output strictly as a JSON array of WriterDiff objects.",
        },
      ],
      messages: [{ role: "user", content: "transcript chunk" }],
    });
    const text = (res.content[0] as { text: string }).text;
    expect(text).toBe("[]");
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test("returns a one-item suggestion array for the follow-up-suggester prompt", async () => {
    const client = createMockAnthropic();
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      system: [
        {
          type: "text",
          text: "Return follow-up questions with text and rationale.",
        },
      ],
      messages: [{ role: "user", content: "topic" }],
    });
    const text = (res.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toMatchObject({
      text: expect.any(String),
      rationale: expect.any(String),
    });
  });

  test("returns a CanvasState shape for the async-stitcher prompt", async () => {
    const client = createMockAnthropic();
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "Output a CanvasState JSON object containing a CanvasSection array.",
      messages: [{ role: "user", content: "stitch" }],
    });
    const text = (res.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({
      title: expect.any(String),
      sections: expect.any(Array),
      meta: expect.objectContaining({ description: expect.any(String) }),
    });
  });
});
