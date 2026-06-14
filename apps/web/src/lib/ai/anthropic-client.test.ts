import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

const { mockAnthropicConstructor } = vi.hoisted(() => ({
  mockAnthropicConstructor: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockSdk {
    constructor(options: { apiKey?: string } | undefined) {
      mockAnthropicConstructor(options);
    }
  },
}));

import {
  createAnthropicClient,
  isMockAnthropicEnabled,
} from "./anthropic-client";
import { createMockAnthropic } from "./mock-anthropic";

describe("anthropic-client factory", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProvider = process.env.LLM_PROVIDER;

  // NODE_ENV is declared `readonly` on `ProcessEnv` in @types/node, but
  // at runtime it is a plain string property — Vitest tests routinely
  // mutate it. Cast to a mutable view to satisfy strict TS.
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    mockAnthropicConstructor.mockClear();
    env.NODE_ENV = "test";
    delete env.LLM_PROVIDER;
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    if (originalProvider === undefined) {
      delete env.LLM_PROVIDER;
    } else {
      env.LLM_PROVIDER = originalProvider;
    }
  });

  test("isMockAnthropicEnabled is true when LLM_PROVIDER=mock and NODE_ENV!=production", () => {
    env.LLM_PROVIDER = "mock";
    env.NODE_ENV = "development";
    expect(isMockAnthropicEnabled()).toBe(true);
  });

  test("isMockAnthropicEnabled is false when LLM_PROVIDER unset", () => {
    env.NODE_ENV = "development";
    expect(isMockAnthropicEnabled()).toBe(false);
  });

  test("isMockAnthropicEnabled is false in production even with LLM_PROVIDER=mock", () => {
    env.LLM_PROVIDER = "mock";
    env.NODE_ENV = "production";
    expect(isMockAnthropicEnabled()).toBe(false);
  });

  test("returns a real Anthropic instance when LLM_PROVIDER!=mock", () => {
    const client = createAnthropicClient({ apiKey: "real-key" });
    expect(mockAnthropicConstructor).toHaveBeenCalledWith({ apiKey: "real-key" });
    expect(client).toBeDefined();
  });

  test("returns the mock client when LLM_PROVIDER=mock", () => {
    env.LLM_PROVIDER = "mock";
    env.NODE_ENV = "development";
    const client = createAnthropicClient({ apiKey: undefined });
    expect(mockAnthropicConstructor).not.toHaveBeenCalled();
    // Mock client exposes messages.create
    expect(typeof client.messages.create).toBe("function");
  });

  test("throws when no apiKey and not in mock mode", () => {
    expect(() => createAnthropicClient({ apiKey: undefined })).toThrow(
      /apiKey/,
    );
  });

  test("mock client returned by factory matches createMockAnthropic shape", () => {
    env.LLM_PROVIDER = "mock";
    env.NODE_ENV = "development";
    const fromFactory = createAnthropicClient({});
    const direct = createMockAnthropic();
    expect(typeof fromFactory.messages.create).toBe("function");
    expect(typeof direct.messages.create).toBe("function");
  });
});
