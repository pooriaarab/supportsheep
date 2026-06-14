import "server-only";

import { randomBytes } from "crypto";
import type { WebhookProviderHint } from "@/lib/webhooks/article-webhook";

interface BuildWebhookIntegrationConfigInput {
  integrationId: string;
  siteUrl: string;
  providerHint: WebhookProviderHint;
}

type StoredWebhookIntegrationConfig = {
  mode: "article_receiver";
  endpointPath: string;
  endpointUrl: string;
  authType: "bearer";
  token: string;
  tokenPreview: string;
  providerHint: WebhookProviderHint;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildWebhookIntegrationConfig({
  integrationId,
  siteUrl,
  providerHint,
}: BuildWebhookIntegrationConfigInput): StoredWebhookIntegrationConfig {
  const token = randomBytes(32).toString("hex");
  const endpointPath = `/api/v1/integrations/webhooks/${integrationId}`;

  return {
    mode: "article_receiver",
    endpointPath,
    endpointUrl: `${trimTrailingSlash(siteUrl)}${endpointPath}`,
    authType: "bearer",
    token,
    tokenPreview: `••••${token.slice(-4)}`,
    providerHint,
  };
}

export function isWebhookIntegrationConfig(
  value: unknown,
): value is StoredWebhookIntegrationConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Record<string, unknown>;
  return (
    config.mode === "article_receiver" &&
    typeof config.endpointPath === "string" &&
    typeof config.endpointUrl === "string" &&
    config.authType === "bearer" &&
    typeof config.token === "string" &&
    typeof config.tokenPreview === "string" &&
    (config.providerHint === "generic" || config.providerHint === "outrank")
  );
}

export function redactWebhookIntegrationConfig(
  config: StoredWebhookIntegrationConfig,
) {
  const { token: _token, ...rest } = config;
  return rest;
}

export function mergeWebhookIntegrationConfigPatch(
  existingConfig: StoredWebhookIntegrationConfig,
  patch: Partial<
    Pick<
      StoredWebhookIntegrationConfig,
      "endpointPath" | "endpointUrl" | "authType" | "providerHint" | "tokenPreview"
    >
  >,
) {
  return {
    ...existingConfig,
    ...patch,
    token: existingConfig.token,
  };
}

export type { StoredWebhookIntegrationConfig };
