import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  isGoogleIntegrationConfig,
  isGoogleOAuthStateFresh,
  parseGoogleOAuthState,
  verifyGoogleOAuthState,
} from "@/lib/integrations/google-integration";
import { getIntegration, updateIntegration } from "@/lib/integrations/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

function redirectToSettings(origin: string, status: "connected" | "error") {
  return NextResponse.redirect(
    `${origin}/settings/integrations?google=${status}`,
  );
}

/**
 * GET /api/v1/integrations/google/callback
 *
 * External OAuth callback — no session available. The integration is looked up
 * by id extracted from the OAuth state parameter, scoped to DEFAULT_blog_id.
 * Public hostname→blog routing is deferred to a later slice; for now all OAuth
 * integrations belong to the default blog.
 */
export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    const origin = request.nextUrl.origin;
    const error = request.nextUrl.searchParams.get("error");
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (error || !code) {
      return redirectToSettings(origin, "error");
    }

    const parsedState = parseGoogleOAuthState(state);
    if (!parsedState) {
      return redirectToSettings(origin, "error");
    }

    const row = await getIntegration(DEFAULT_blog_id, parsedState.integrationId);
    if (!row || !isGoogleIntegrationConfig(row.config)) {
      return redirectToSettings(origin, "error");
    }

    const config = row.config;
    if (
      !config.oauthState ||
      !verifyGoogleOAuthState(state, row.id, config.oauthState.value) ||
      !isGoogleOAuthStateFresh(config.oauthState.createdAt)
    ) {
      return redirectToSettings(origin, "error");
    }

    const client = new google.auth.OAuth2(
      config.oauthClientId,
      config.oauthClientSecret,
      config.redirectUri,
    );
    let tokens;
    try {
      ({ tokens } = await client.getToken(code));
    } catch {
      return redirectToSettings(origin, "error");
    }

    const nextConfig = { ...config };
    delete nextConfig.oauthState;

    if (!tokens.refresh_token) {
      await updateIntegration(DEFAULT_blog_id, row.id, {
        config: nextConfig,
        status: "error",
      });
      return redirectToSettings(origin, "error");
    }

    nextConfig.oauth = {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? undefined,
      tokenType: tokens.token_type ?? undefined,
      scope: tokens.scope ?? undefined,
      expiryDate: tokens.expiry_date ?? undefined,
    };

    await updateIntegration(DEFAULT_blog_id, row.id, {
      config: nextConfig,
      status: "connected",
      connectedAt: Date.now(),
    });

    return redirectToSettings(origin, "connected");
  },
});
