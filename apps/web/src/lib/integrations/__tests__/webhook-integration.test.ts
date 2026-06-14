import { describe, expect, it } from "vitest";
import {
  buildWebhookIntegrationConfig,
  mergeWebhookIntegrationConfigPatch,
  redactWebhookIntegrationConfig,
} from "@/lib/integrations/webhook-integration";

describe("webhook integration helpers", () => {
  it("builds a one-time token and redacts it for later reads", () => {
    const built = buildWebhookIntegrationConfig({
      integrationId: "integration-1",
      siteUrl: "https://supportsheep.com",
      providerHint: "outrank",
    });

    expect(built.token).toHaveLength(64);
    expect(built.endpointPath).toBe(
      "/api/v1/integrations/webhooks/integration-1",
    );
    expect(built.endpointUrl).toBe(
      "https://supportsheep.com/api/v1/integrations/webhooks/integration-1",
    );

    expect(redactWebhookIntegrationConfig(built)).toEqual({
      mode: built.mode,
      endpointPath: built.endpointPath,
      endpointUrl: built.endpointUrl,
      authType: built.authType,
      tokenPreview: expect.stringMatching(/^••••/),
      providerHint: built.providerHint,
    });
  });

  it("merges safe config patches without dropping the stored token", () => {
    const built = buildWebhookIntegrationConfig({
      integrationId: "integration-1",
      siteUrl: "https://supportsheep.com",
      providerHint: "generic",
    });

    expect(
      mergeWebhookIntegrationConfigPatch(built, {
        providerHint: "outrank",
      }),
    ).toEqual({
      ...built,
      providerHint: "outrank",
    });
  });
});
