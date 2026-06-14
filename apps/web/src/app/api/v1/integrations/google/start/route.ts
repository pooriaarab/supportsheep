import { randomBytes } from "node:crypto";

import { google } from "googleapis";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  buildGoogleOAuthState,
  isGoogleIntegrationConfig,
} from "@/lib/integrations/google-integration";
import { getIntegration, updateIntegration } from "@/lib/integrations/repository";

const startGoogleOAuthSchema = z.object({
  integrationId: z.string().min(1),
});

export const POST = createApiHandler({
  auth: "user",
  input: startGoogleOAuthSchema,
  audit: "update_integration",
  handler: async ({ body, blogId }) => {
    const row = await getIntegration(blogId, body.integrationId);
    if (!row) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 },
      );
    }

    if (!isGoogleIntegrationConfig(row.config)) {
      return NextResponse.json(
        { error: "Google OAuth settings are not configured" },
        { status: 400 },
      );
    }

    const nonce = randomBytes(24).toString("hex");
    const state = buildGoogleOAuthState(row.id, nonce);
    const newConfig = {
      ...row.config,
      oauthState: {
        value: nonce,
        createdAt: Date.now(),
      },
    };

    await updateIntegration(blogId, row.id, {
      config: newConfig,
      status: "disconnected",
    });

    const client = new google.auth.OAuth2(
      newConfig.oauthClientId,
      newConfig.oauthClientSecret,
      newConfig.redirectUri,
    );
    const authorizationUrl = client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: newConfig.scopes,
      state,
    });

    return NextResponse.json({ authorizationUrl });
  },
});
