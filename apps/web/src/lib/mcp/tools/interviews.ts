/**
 * MCP Interview Tools
 *
 * Currently exposes `start_interview` — agents can mint a share link and
 * receive a join URL + plaintext token to hand to a guest.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createShareLink } from "@/lib/interviews/share-links-repository";
import {
  generateShareLinkToken,
} from "@/lib/interviews/share-link-token";
import {
  SHARE_LINK_VISIBILITY,
  INTERVIEW_STYLE,
  RECORDING_CONFIG,
  AUTH_MODE,
  DEFAULT_DURATION_SEC,
  MAX_DURATION_SEC,
} from "@/lib/interviews/share-link-schema";
import { textResult } from "./shared";
import type { McpToolContext } from "./context";

export function registerInterviewTools(
  server: McpServer,
  { blogId, ownerId }: McpToolContext,
) {
  server.tool(
    "start_interview",
    "Mint a share link for an AI interview. Returns a join URL + plaintext token (token is shown ONCE — store it). The guest opens the URL to land on the consent screen and begin the interview.",
    {
      topic: z
        .string()
        .max(500)
        .optional()
        .describe("Subject of the interview (e.g., 'Migrating from MySQL to Postgres')"),
      goal: z
        .string()
        .max(2000)
        .optional()
        .describe("What the interview should accomplish"),
      type: z
        .enum(SHARE_LINK_VISIBILITY)
        .default("link")
        .describe("Visibility: 'private' (logged-in workspace), 'link' (anyone with URL), 'workspace' (any workspace member)"),
      style: z
        .enum(INTERVIEW_STYLE)
        .default("smart")
        .describe("Interview style hint passed to the realtime model"),
      authMode: z
        .enum(AUTH_MODE)
        .default("anonymous")
        .describe("Guest auth gate: anonymous, email (capture name+email), or magic_link"),
      recordingConfig: z
        .enum(RECORDING_CONFIG)
        .default("transcript")
        .describe("What the session captures: 'transcript' or 'audio'"),
      maxDurationSec: z
        .number()
        .int()
        .positive()
        .max(MAX_DURATION_SEC)
        .default(DEFAULT_DURATION_SEC)
        .describe(`Max interview duration in seconds (default ${DEFAULT_DURATION_SEC}, max ${MAX_DURATION_SEC})`),
    },
    async (input) =>
      textResult(
        JSON.stringify(
          await startInterview(input, { blogId, ownerId }),
          null,
          2,
        ),
      ),
  );
}

export interface StartInterviewInput {
  topic?: string;
  goal?: string;
  type: (typeof SHARE_LINK_VISIBILITY)[number];
  style: (typeof INTERVIEW_STYLE)[number];
  authMode: (typeof AUTH_MODE)[number];
  recordingConfig: (typeof RECORDING_CONFIG)[number];
  maxDurationSec: number;
}

export interface StartInterviewResult {
  shareLinkId: string;
  token: string;
  joinUrl: string;
  note: string;
}

/** Identity the interview share link is created under (the caller's tenant). */
export interface StartInterviewScope {
  blogId: string;
  ownerId: string;
}

/** Pure handler — easier to unit test than the MCP-wrapped form. */
export async function startInterview(
  input: StartInterviewInput,
  scope: StartInterviewScope,
): Promise<StartInterviewResult> {
  const { token, hash } = generateShareLinkToken();

  const link = await createShareLink(scope.blogId, {
    type: input.type,
    createdBy: scope.ownerId,
    workspaceId: scope.blogId,
    topic: input.topic ?? null,
    goal: input.goal ?? null,
    style: input.style,
    authMode: input.authMode,
    recordingConfig: input.recordingConfig,
    maxDurationSec: input.maxDurationSec,
    expiresAt: null,
    maxUses: null,
    tokenHash: hash,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://blogbat.com";
  return {
    shareLinkId: link.id,
    token,
    joinUrl: `${baseUrl}/i/${token}`,
    note: "The token is shown ONCE. Persist it now — it cannot be retrieved later. Anyone with the URL can join (per the chosen `type` + `authMode` gates).",
  };
}
