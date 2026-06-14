import { z } from "zod";

export const SHARE_LINK_VISIBILITY = ["private", "link", "workspace"] as const;
export type ShareLinkVisibility = (typeof SHARE_LINK_VISIBILITY)[number];

export const INTERVIEW_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "nl", "ja", "ko", "zh",
] as const;
export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<InterviewLanguage, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};

export const INTERVIEW_STYLE = [
  "testimonial",
  "eeat",
  "case_study",
  "qa",
  "launch",
  "smart",
] as const;
export type InterviewStyle = (typeof INTERVIEW_STYLE)[number];

export const RECORDING_CONFIG = ["transcript", "audio", "video"] as const;
export type RecordingConfig = (typeof RECORDING_CONFIG)[number];

export const AUTH_MODE = ["anonymous", "email", "magic_link"] as const;
export type AuthMode = (typeof AUTH_MODE)[number];

export const SHARE_LINK_STATUS = ["active", "revoked", "expired"] as const;
export type ShareLinkStatus = (typeof SHARE_LINK_STATUS)[number];

export const MAX_DURATION_SEC = 1800; // 30 min hard cap per design doc
export const DEFAULT_DURATION_SEC = 300; // 5 min default

export const ShareLinkCreateInput = z.object({
  type: z.enum(SHARE_LINK_VISIBILITY),
  topic: z.string().max(500).optional(),
  goal: z.string().max(2000).optional(),
  style: z.enum(INTERVIEW_STYLE).default("smart"),
  authMode: z.enum(AUTH_MODE).default("anonymous"),
  recordingConfig: z.enum(RECORDING_CONFIG).default("transcript"),
  maxDurationSec: z
    .number()
    .int()
    .positive()
    .max(MAX_DURATION_SEC)
    .default(DEFAULT_DURATION_SEC),
  expiresAt: z.string().datetime().optional(), // ISO 8601
  maxUses: z.number().int().positive().nullable().default(null),
  language: z.enum(INTERVIEW_LANGUAGES).default("en"),
  scheduledAt: z.string().datetime().nullable().optional(),
  scheduledGuestEmail: z.string().email().nullable().optional(),
  mode: z.enum(["live", "async"]).default("live"),
  asyncQuestions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(), // displayed transcript
        audioStoragePath: z.string(), // path in Firebase Storage
      })
    )
    .max(20)
    .optional(),
});
export type ShareLinkCreateInput = z.infer<typeof ShareLinkCreateInput>;

// Update schema permits partial updates, but excludes immutable fields and avoids defaulting omitted keys.
// Uses .strict() to reject unrecognized keys (such as immutable fields).
export const ShareLinkUpdateInput = z
  .object({
    topic: z.string().max(500).optional(),
    goal: z.string().max(2000).optional(),
    style: z.enum(INTERVIEW_STYLE).optional(),
    maxDurationSec: z
      .number()
      .int()
      .positive()
      .max(MAX_DURATION_SEC)
      .optional(),
    expiresAt: z.string().datetime().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    language: z.enum(INTERVIEW_LANGUAGES).optional(),
  })
  .strict();
export type ShareLinkUpdateInput = z.infer<typeof ShareLinkUpdateInput>;

export interface ShareLinkRecord {
  id: string;
  type: ShareLinkVisibility;
  createdBy: string;
  workspaceId: "default";
  topic: string | null;
  goal: string | null;
  style: InterviewStyle;
  authMode: AuthMode;
  recordingConfig: RecordingConfig;
  maxDurationSec: number;
  expiresAt: string | null; // ISO
  maxUses: number | null;
  uses: number;
  status: ShareLinkStatus;
  tokenHash: string; // SHA-256 hex of the plaintext token; plaintext is NEVER persisted
  createdAt: string;
  updatedAt: string;
  language: InterviewLanguage;
  scheduledAt?: string | null;
  scheduledGuestEmail?: string | null;
  mode?: "live" | "async";
  asyncQuestions?: Array<{
    id: string;
    text: string;
    audioStoragePath: string;
  }>;
}

// Public-safe projection — returned by GET /by-token/[token]
export type ShareLinkPublicView = Pick<
  ShareLinkRecord,
  | "topic"
  | "goal"
  | "style"
  | "recordingConfig"
  | "maxDurationSec"
  | "authMode"
  | "type"
  | "status"
  | "language"
  | "scheduledAt"
  | "mode"
>;
