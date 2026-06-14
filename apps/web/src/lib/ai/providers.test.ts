import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  anthropicModel: vi.fn(),
  createAnthropic: vi.fn(),
  createOpenAI: vi.fn(),
  createGoogleGenerativeAI: vi.fn(),
  googleModel: vi.fn(),
  openaiModel: vi.fn(),
  getBlogConfig: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: mocks.createAnthropic,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mocks.createGoogleGenerativeAI,
}));

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mocks.getBlogConfig,
}));

describe("providers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createAnthropic.mockReturnValue(mocks.anthropicModel);
    mocks.createOpenAI.mockReturnValue(mocks.openaiModel);
    mocks.createGoogleGenerativeAI.mockReturnValue(mocks.googleModel);
    mocks.anthropicModel.mockReturnValue({ provider: "claude" });
    mocks.openaiModel.mockReturnValue({ provider: "gpt" });
    mocks.googleModel.mockReturnValue({ provider: "gemini" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trims the stored API key and falls back to the stored model", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      ai: {
        providers: {
          claude: {
            apiKey: "  sk-ant-settings  ",
            model: "  claude-sonnet-4-6  ",
          },
        },
      },
    });

    const { getProviderModel } = await import("./providers");
    await getProviderModel("claude", " ");

    expect(mocks.createAnthropic).toHaveBeenCalledWith({
      apiKey: "sk-ant-settings",
    });
    expect(mocks.anthropicModel).toHaveBeenCalledWith("claude-sonnet-4-6");
  });

  it("throws when the stored key is missing — no env fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-env");
    mocks.getBlogConfig.mockResolvedValue({
      ai: {
        providers: {
          gpt: { apiKey: "   ", model: "   " },
        },
      },
    });

    const { getProviderModel } = await import("./providers");
    await expect(getProviderModel("gpt", "")).rejects.toThrow(
      /OpenAI API key not configured/,
    );
    expect(mocks.createOpenAI).not.toHaveBeenCalled();
  });

  it("getProviderApiKey returns the raw key from config", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      ai: {
        providers: {
          gpt: { apiKey: "  sk-openai-from-settings  " },
        },
      },
    });

    const { getProviderApiKey } = await import("./providers");
    await expect(getProviderApiKey("gpt")).resolves.toBe(
      "sk-openai-from-settings",
    );
  });

  it("getProviderApiKey throws when no config is available", async () => {
    mocks.getBlogConfig.mockResolvedValue(null);
    const { getProviderApiKey } = await import("./providers");
    await expect(getProviderApiKey("claude")).rejects.toThrow(
      /Claude API key not configured/,
    );
  });
});
