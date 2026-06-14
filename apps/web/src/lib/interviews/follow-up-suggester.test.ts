import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { suggestFollowUps } from "./follow-up-suggester";

// Mock the logger to avoid polluting stdout
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

// Mock the providers to control the API key resolution
const mockGetProviderApiKey = vi.fn();
vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: (...args: unknown[]) => mockGetProviderApiKey(...args),
}));

// Mock the Anthropic SDK
const { mockAnthropicConstructor, mockMessagesCreate } = vi.hoisted(() => {
  const mockMessagesCreate = vi.fn();
  const mockAnthropicConstructor = vi.fn();
  return { mockAnthropicConstructor, mockMessagesCreate };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      constructor(options: { apiKey?: string } | undefined) {
        mockAnthropicConstructor(options);
      }
      messages = {
        create: mockMessagesCreate,
      };
    },
  };
});

describe("suggestFollowUps", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    mockGetProviderApiKey.mockResolvedValue("settings-anthropic-key");
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("throws error if no API key is available (both settings and env missing)", async () => {
    mockGetProviderApiKey.mockRejectedValue(new Error("No key"));
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      suggestFollowUps({
        topic: "React hooks",
        style: "conversational",
        transcript: "Let's talk about useEffect.",
      }),
    ).rejects.toThrow(/Anthropic API key not configured/);
  });

  test("resolves API key from settings first, then falls back to env", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { text: "What about cleanup?", rationale: "Follow up on cleanup" },
          ]),
        },
      ],
    });

    // Case 1: settings exists
    await suggestFollowUps({
      topic: "React",
      style: "curious",
      transcript: "effects",
    });
    expect(mockAnthropicConstructor).toHaveBeenCalledWith({ apiKey: "settings-anthropic-key" });

    // Case 2: settings fails, fall back to env
    vi.clearAllMocks();
    mockGetProviderApiKey.mockRejectedValue(new Error("No key in settings"));
    process.env.ANTHROPIC_API_KEY = "env-key";

    await suggestFollowUps({
      topic: "React",
      style: "curious",
      transcript: "effects",
    });
    expect(mockAnthropicConstructor).toHaveBeenCalledWith({ apiKey: "env-key" });
  });

  test("calls Anthropic Claude with correct parameters including prompt caching", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { text: "Question 1", rationale: "Rationale 1" },
            { text: "Question 2", rationale: "Rationale 2" },
          ]),
        },
      ],
    });

    const result = await suggestFollowUps({
      topic: "Typescript Generics",
      style: "probing",
      transcript: "Can we talk about standard mapped types?",
    });

    expect(result).toEqual([
      { text: "Question 1", rationale: "Rationale 1" },
      { text: "Question 2", rationale: "Rationale 2" },
    ]);

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            cache_control: { type: "ephemeral" },
          }),
        ]),
        messages: [
          {
            role: "user",
            content: expect.stringContaining("Topic: Typescript Generics"),
          },
        ],
      }),
    );
  });

  test("handles malformed JSON array tolerantly", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Here are some suggestions:\n```json\n[\n  {\"text\": \"Ok?\", \"rationale\": \"just checking\"}\n]\n```",
        },
      ],
    });

    const result = await suggestFollowUps({
      topic: "Testing",
      style: "bold",
      transcript: "TDD flow",
    });

    expect(result).toEqual([{ text: "Ok?", rationale: "just checking" }]);
  });
});
