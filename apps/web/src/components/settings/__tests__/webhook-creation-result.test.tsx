import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WebhookCreationResult } from "@/components/settings/webhook-creation-result";

describe("WebhookCreationResult", () => {
  it("renders the generated webhook url and access token with the one-time warning", () => {
    const html = renderToStaticMarkup(
      <WebhookCreationResult
        endpointUrl="https://supportsheep.com/api/v1/integrations/webhooks/integration-1"
        token="secret-token"
        onDone={() => {}}
      />,
    );

    expect(html).toContain("Webhook URL");
    expect(html).toContain("Access Token");
    expect(html).toContain("shown only once");
    expect(html).toContain("Authorization: Bearer");
  });
});
