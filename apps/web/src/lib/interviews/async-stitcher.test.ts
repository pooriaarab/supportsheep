import { describe, test, expect, vi, beforeEach } from "vitest";
import { stitchAsyncInterview } from "./async-stitcher";
import type Anthropic from "@anthropic-ai/sdk";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

describe("async-stitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws error if client and apiKey are both missing", async () => {
    await expect(
      stitchAsyncInterview({
        questions: [{ id: "q1", text: "What is your name?" }],
        responses: [{ questionId: "q1", transcript: "My name is Bob." }],
      })
    ).rejects.toThrow(/apiKey/);
  });

  test("returns empty CanvasState if there are no responses", async () => {
    const mockCreate = vi.fn();
    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const result = await stitchAsyncInterview({
      questions: [{ id: "q1", text: "What is your name?" }],
      responses: [],
      client: mockClient,
    });

    expect(result).toEqual({
      title: "No responses provided",
      sections: [],
      meta: {
        description: "",
        tags: [],
        suggestedCategory: null,
      },
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("correctly stitches questions and responses and calls Claude Sonnet", async () => {
    const mockCanvasState = {
      title: "Bob's Journey in Web Development",
      sections: [
        {
          id: "section-1",
          heading: "Introduction",
          bullets: [],
          paragraphs: ["Bob is a software engineer who loves coding in TypeScript."],
          quotes: [{ text: "My name is Bob.", attributedTo: "Bob" }],
          finalized: true,
        },
      ],
      meta: {
        description: "An interview with Bob about web development.",
        tags: ["typescript", "coding"],
        suggestedCategory: "Engineering",
      },
    };

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockCanvasState) }],
    });

    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const result = await stitchAsyncInterview({
      questions: [
        { id: "q1", text: "What is your name?" },
        { id: "q2", text: "What is your favorite language?" },
      ],
      responses: [
        { questionId: "q1", transcript: "My name is Bob." },
        { questionId: "q2", transcript: "I love TypeScript!" },
      ],
      topic: "Web Development",
      goal: "Inspirations",
      language: "en",
      guestName: "Bob",
      client: mockClient,
    });

    expect(result).toEqual(mockCanvasState);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
    expect(callArgs.system).toContain("You are an expert editor and blog writer");
    
    // Check that transcript is passed in the message body
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain("Q: What is your name?");
    expect(userMessage).toContain("A: My name is Bob.");
    expect(userMessage).toContain("Q: What is your favorite language?");
    expect(userMessage).toContain("A: I love TypeScript!");
    expect(userMessage).toContain("Topic: Web Development");
    expect(userMessage).toContain("Goal: Inspirations");
    expect(userMessage).toContain("Language: en");
  });
});
