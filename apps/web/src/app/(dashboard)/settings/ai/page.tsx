"use client";

/**
 * Settings > AI Providers
 *
 * Three provider cards (Claude, GPT, Gemini) with API key input,
 * model selector, test connection button. Default provider and
 * context tag selectors. Auto-saves on blur/change.
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Loader2, Zap, CheckCircle2, XCircle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { BlogConfig, ContextTag } from "@repo/types";

/* ---------- API helpers ---------- */

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch config");
  return (await res.json()).data;
}

async function fetchContextTags(): Promise<ContextTag[]> {
  const res = await fetch("/api/v1/context-tags");
  if (!res.ok) return [];
  return (await res.json()).data ?? [];
}

async function updateBlogConfig(
  data: Record<string, unknown>,
): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return (await res.json()).data;
}

/* ---------- Provider config ---------- */

const PROVIDERS = [
  {
    key: "claude" as const,
    name: "Claude (Anthropic)",
    models: [
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
    ],
    color: "bg-warning-subtle text-warning-foreground",
  },
  {
    key: "gpt" as const,
    name: "GPT (OpenAI)",
    models: [
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ],
    color: "bg-success-subtle text-success-foreground",
  },
  {
    key: "gemini" as const,
    name: "Gemini (Google)",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    color: "bg-info-subtle text-info-foreground",
  },
];

/* ---------- Test connection ---------- */

interface TestResult {
  provider: string;
  status: "idle" | "testing" | "success" | "error";
  message?: string;
}

/* ---------- Page ---------- */

export default function AiSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });

  const { data: contextTags = [] } = useQuery({
    queryKey: queryKeys.contextTags.lists(),
    queryFn: fetchContextTags,
  });

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [avatarIds, setAvatarIds] = useState<Record<string, string>>({});
  const [personaIds, setPersonaIds] = useState<Record<string, string>>({});
  const [defaultProvider, setDefaultProvider] = useState<string | null>(null);
  const [defaultContextTagId, setDefaultContextTagId] = useState<string | null>(
    null,
  );
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {},
  );
  const [imageKeys, setImageKeys] = useState<Record<string, string>>({});

  const getImageApiKey = useCallback(
    (provider: "unsplash" | "pexels") =>
      imageKeys[provider] ?? config?.images?.[provider]?.apiKey ?? "",
    [imageKeys, config],
  );

  const currentDefaultProvider =
    defaultProvider ?? config?.ai?.defaultProvider ?? "claude";
  const currentContextTag =
    defaultContextTagId ?? config?.ai?.defaultContextTagId ?? "";

  type ProviderKey = keyof NonNullable<BlogConfig["ai"]>["providers"];

  const getApiKey = useCallback(
    (provider: string) =>
      apiKeys[provider] ??
      config?.ai?.providers?.[provider as ProviderKey]?.apiKey ??
      "",
    [apiKeys, config],
  );

  const getModel = useCallback(
    (provider: string) => {
      if (provider === "tavus") return "";
      return (
        models[provider] ??
        config?.ai?.providers?.[provider as "claude" | "gpt" | "gemini"]?.model ??
        ""
      );
    },
    [models, config],
  );

  const getAvatarId = useCallback(
    (provider: string) => {
      if (provider !== "tavus") return "";
      return (
        avatarIds[provider] ??
        config?.ai?.providers?.tavus?.defaultAvatarId ??
        ""
      );
    },
    [avatarIds, config],
  );

  const getPersonaId = useCallback(
    (provider: string) => {
      if (provider !== "tavus") return "";
      return (
        personaIds[provider] ??
        config?.ai?.providers?.tavus?.defaultPersonaId ??
        ""
      );
    },
    [personaIds, config],
  );

  // Debounced autosave
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogConfig.all });
      toast.success("AI settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const debouncedSave = useCallback(
    (overrides?: {
      apiKeyOverrides?: Record<string, string>;
      modelOverrides?: Record<string, string>;
      avatarIdOverrides?: Record<string, string>;
      personaIdOverrides?: Record<string, string>;
      defaultProviderOverride?: string;
      defaultContextTagIdOverride?: string;
    }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const mergedApiKeys = { ...apiKeys, ...overrides?.apiKeyOverrides };
        const mergedModels = { ...models, ...overrides?.modelOverrides };
        const mergedAvatarIds = { ...avatarIds, ...overrides?.avatarIdOverrides };
        const mergedPersonaIds = {
          ...personaIds,
          ...overrides?.personaIdOverrides,
        };
        const dp =
          overrides?.defaultProviderOverride ??
          defaultProvider ??
          config?.ai?.defaultProvider ??
          "claude";
        const dct =
          overrides?.defaultContextTagIdOverride ??
          defaultContextTagId ??
          config?.ai?.defaultContextTagId ??
          "";

        const providers: NonNullable<BlogConfig["ai"]>["providers"] = {
          claude: {
            apiKey:
              mergedApiKeys.claude ??
              config?.ai?.providers?.claude?.apiKey ??
              "",
            model:
              mergedModels.claude ??
              config?.ai?.providers?.claude?.model ??
              "",
          },
          gpt: {
            apiKey:
              mergedApiKeys.gpt ??
              config?.ai?.providers?.gpt?.apiKey ??
              "",
            model:
              mergedModels.gpt ??
              config?.ai?.providers?.gpt?.model ??
              "",
          },
          gemini: {
            apiKey:
              mergedApiKeys.gemini ??
              config?.ai?.providers?.gemini?.apiKey ??
              "",
            model:
              mergedModels.gemini ??
              config?.ai?.providers?.gemini?.model ??
              "",
          },
          tavus: {
            apiKey:
              mergedApiKeys.tavus ??
              config?.ai?.providers?.tavus?.apiKey ??
              "",
            defaultAvatarId:
              mergedAvatarIds.tavus ??
              config?.ai?.providers?.tavus?.defaultAvatarId ??
              "",
            defaultPersonaId:
              mergedPersonaIds.tavus ??
              config?.ai?.providers?.tavus?.defaultPersonaId ??
              "",
          },
        };

        mutation.mutate({
          ai: {
            defaultProvider: dp,
            providers,
            defaultContextTagId: dct,
          },
        });
      }, 1500);
    },
    [
      apiKeys,
      models,
      avatarIds,
      personaIds,
      defaultProvider,
      defaultContextTagId,
      config,
      mutation,
    ],
  );

  const handleApiKeyBlur = useCallback(
    (providerKey: string) => {
      // Only save if the value actually changed
      const current = apiKeys[providerKey];
      if (current !== undefined) {
        const trimmed = current.trim();
        if (trimmed !== current) {
          setApiKeys((prev) => ({ ...prev, [providerKey]: trimmed }));
        }
        debouncedSave({ apiKeyOverrides: { [providerKey]: trimmed } });
      }
    },
    [apiKeys, debouncedSave],
  );

  const handleAvatarIdBlur = useCallback(
    (providerKey: string) => {
      // Only save if the value actually changed
      const current = avatarIds[providerKey];
      if (current !== undefined) {
        const trimmed = current.trim();
        if (trimmed !== current) {
          setAvatarIds((prev) => ({ ...prev, [providerKey]: trimmed }));
        }
        debouncedSave({ avatarIdOverrides: { [providerKey]: trimmed } });
      }
    },
    [avatarIds, debouncedSave],
  );

  const handlePersonaIdBlur = useCallback(
    (providerKey: string) => {
      const current = personaIds[providerKey];
      if (current !== undefined) {
        const trimmed = current.trim();
        if (trimmed !== current) {
          setPersonaIds((prev) => ({ ...prev, [providerKey]: trimmed }));
        }
        debouncedSave({ personaIdOverrides: { [providerKey]: trimmed } });
      }
    },
    [personaIds, debouncedSave],
  );

  const handleModelChange = useCallback(
    (providerKey: string, model: string) => {
      setModels((prev) => ({ ...prev, [providerKey]: model }));
      debouncedSave({ modelOverrides: { [providerKey]: model } });
    },
    [debouncedSave],
  );

  const handleDefaultProviderChange = useCallback(
    (value: string) => {
      setDefaultProvider(value);
      debouncedSave({ defaultProviderOverride: value });
    },
    [debouncedSave],
  );

  const handleDefaultContextTagChange = useCallback(
    (value: string) => {
      const resolved = value === "none" ? "" : value;
      setDefaultContextTagId(resolved);
      debouncedSave({ defaultContextTagIdOverride: resolved });
    },
    [debouncedSave],
  );

  // Real API test
  const handleTest = useCallback(
    async (providerKey: string) => {
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: { provider: providerKey, status: "testing" as const },
      }));

      const key = getApiKey(providerKey).trim();
      const model = getModel(providerKey).trim();

      if (!key || key.length < 10) {
        setTestResults((prev) => ({
          ...prev,
          [providerKey]: {
            provider: providerKey,
            status: "error" as const,
            message: "API key is too short",
          },
        }));
        return;
      }

      try {
        const res = await fetch("/api/v1/ai/test", {
          method: "Article",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: providerKey,
            apiKey: key,
            model:
              model ||
              PROVIDERS.find((p) => p.key === providerKey)?.models[0] ||
              "",
          }),
        });

        const data = (await res.json()) as {
          success: boolean;
          message: string;
        };

        setTestResults((prev) => ({
          ...prev,
          [providerKey]: {
            provider: providerKey,
            status: data.success ? ("success" as const) : ("error" as const),
            message: data.message,
          },
        }));
      } catch {
        setTestResults((prev) => ({
          ...prev,
          [providerKey]: {
            provider: providerKey,
            status: "error" as const,
            message: "Failed to reach test endpoint",
          },
        }));
      }
    },
    [getApiKey, getModel],
  );

  const handleImageApiKeyBlur = useCallback(
    (provider: "unsplash" | "pexels") => {
      const current = imageKeys[provider];
      if (current !== undefined) {
        mutation.mutate({
          images: { [provider]: { apiKey: current } },
        });
      }
    },
    [imageKeys, mutation],
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "AI Providers" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {PROVIDERS.map((provider) => {
                const test = testResults[provider.key];
                return (
                  <Card key={provider.key} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {provider.name}
                        </h3>
                        {currentDefaultProvider === provider.key && (
                          <Badge variant="secondary" className="text-[10px]">
                            Default
                          </Badge>
                        )}
                      </div>
                      <Badge className={`${provider.color} text-[10px]`}>
                        {getApiKey(provider.key) ? "Configured" : "Not Set"}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.key}-key`}>API Key</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider.key}-key`}
                            type="password"
                            value={getApiKey(provider.key)}
                            onChange={(e) =>
                              setApiKeys((prev) => ({
                                ...prev,
                                [provider.key]: e.target.value,
                              }))
                            }
                            onBlur={() => handleApiKeyBlur(provider.key)}
                            placeholder={`Enter ${provider.name} API key`}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTest(provider.key)}
                            disabled={test?.status === "testing"}
                            className="gap-1.5 shrink-0"
                          >
                            {test?.status === "testing" ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Zap className="size-3.5" />
                            )}
                            Test
                          </Button>
                        </div>
                        {test?.status === "success" && (
                          <p className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="size-3" />
                            {test.message}
                          </p>
                        )}
                        {test?.status === "error" && (
                          <p className="flex items-center gap-1 text-xs text-error">
                            <XCircle className="size-3" />
                            {test.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Select
                          value={getModel(provider.key)}
                          onValueChange={(v) =>
                            handleModelChange(provider.key, v)
                          }
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {provider.models.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Tavus (Video & Avatar)
                    </h3>
                  </div>
                  <Badge className="bg-info-subtle text-info-foreground text-[10px]">
                    {getApiKey("tavus") ? "Configured" : "Not Set"}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tavus-key">API Key</Label>
                    <Input
                      id="tavus-key"
                      type="password"
                      value={getApiKey("tavus")}
                      onChange={(e) =>
                        setApiKeys((prev) => ({
                          ...prev,
                          tavus: e.target.value,
                        }))
                      }
                      onBlur={() => handleApiKeyBlur("tavus")}
                      placeholder="Enter Tavus API key"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tavus-avatar">Default Avatar (Replica ID)</Label>
                    <Input
                      id="tavus-avatar"
                      type="text"
                      value={getAvatarId("tavus")}
                      onChange={(e) =>
                        setAvatarIds((prev) => ({
                          ...prev,
                          tavus: e.target.value,
                        }))
                      }
                      onBlur={() => handleAvatarIdBlur("tavus")}
                      placeholder="Enter default replica/avatar ID"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tavus-persona">Default Persona ID</Label>
                    <Input
                      id="tavus-persona"
                      type="text"
                      value={getPersonaId("tavus")}
                      onChange={(e) =>
                        setPersonaIds((prev) => ({
                          ...prev,
                          tavus: e.target.value,
                        }))
                      }
                      onBlur={() => handlePersonaIdBlur("tavus")}
                      placeholder="Enter default persona ID"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required by the Tavus Conversation API. Find it in
                      your Tavus dashboard under Personas.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Defaults
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default AI Provider</Label>
                    <Select
                      value={currentDefaultProvider}
                      onValueChange={handleDefaultProviderChange}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {contextTags.length > 0 && (
                    <div className="space-y-2">
                      <Label>Default Context Tag</Label>
                      <p className="text-xs text-muted-foreground">
                        Applied to new article generation by default
                      </p>
                      <Select
                        value={currentContextTag}
                        onValueChange={handleDefaultContextTagChange}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {contextTags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Image APIs
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure image providers for automatic featured image
                  selection during article generation.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="unsplash-key">Unsplash Access Key</Label>
                    <Input
                      id="unsplash-key"
                      type="password"
                      value={getImageApiKey("unsplash")}
                      onChange={(e) =>
                        setImageKeys((prev) => ({
                          ...prev,
                          unsplash: e.target.value,
                        }))
                      }
                      onBlur={() => handleImageApiKeyBlur("unsplash")}
                      placeholder="Enter Unsplash Access Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pexels-key">Pexels API Key</Label>
                    <Input
                      id="pexels-key"
                      type="password"
                      value={getImageApiKey("pexels")}
                      onChange={(e) =>
                        setImageKeys((prev) => ({
                          ...prev,
                          pexels: e.target.value,
                        }))
                      }
                      onBlur={() => handleImageApiKeyBlur("pexels")}
                      placeholder="Enter Pexels API key"
                    />
                  </div>
                </div>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Settings are saved automatically when you change a value.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
