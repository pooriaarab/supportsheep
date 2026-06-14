import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * interviews — one row per interview session.
 *
 * Timestamps are epoch-ms integers.
 * JSON-serialized fields (canvasSnapshot) are stored as TEXT.
 */
export const interviews = sqliteTable(
  "interviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    status: text("status").notNull().default("consent"), // "consent" | "live" | "ended"
    startedByUid: text("started_by_uid"),
    startedByRole: text("started_by_role"),
    shareLinkId: text("share_link_id"),
    guestEmail: text("guest_email"),
    guestName: text("guest_name"),
    topic: text("topic"),
    goal: text("goal"),
    style: text("style").notNull().default("smart"),
    recordingConfig: text("recording_config").notNull().default("transcript"),
    language: text("language").notNull().default("en"),
    mode: text("mode").notNull().default("live"), // "live" | "async"
    maxDurationSec: integer("max_duration_sec").notNull().default(300),
    canvasSnapshot: text("canvas_snapshot"), // JSON
    canvasSnapshotAt: integer("canvas_snapshot_at"), // epoch-ms
    articleId: text("article_id"),
    publishedDirect: integer("published_direct"), // boolean 0/1
    requiresReview: integer("requires_review"), // boolean 0/1
    endedAt: integer("ended_at"), // epoch-ms
    startedAt: integer("started_at"), // epoch-ms
    responsesCount: integer("responses_count").notNull().default(0),
    // video provider fields
    videoProvider: text("video_provider"),
    tavusConversationId: text("tavus_conversation_id"),
    videoStoragePath: text("video_storage_path"), // R2 key of the recorded video
    // cost tracking
    costUsd: integer("cost_usd"), // stored as fractional cents * 10000
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("interviews_blog_idx").on(t.blogId),
    index("interviews_blog_uid_idx").on(t.blogId, t.startedByUid),
    index("interviews_blog_status_idx").on(t.blogId, t.status),
    index("interviews_blog_share_link_idx").on(t.blogId, t.shareLinkId),
    index("interviews_blog_created_idx").on(t.blogId, t.createdAt),
    index("interviews_tavus_conversation_idx").on(t.tavusConversationId),
  ],
);

/**
 * share_links — one row per share-link configuration.
 *
 * tokenHash is unique across the entire table (token_hash is a SHA-256 hex
 * digest of the plaintext token — the plaintext is never stored).
 * asyncQuestions is JSON-serialized TEXT.
 * Timestamps are epoch-ms integers; expiresAt/scheduledAt are ISO strings.
 */
export const shareLinks = sqliteTable(
  "share_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    type: text("type").notNull(), // ShareLinkVisibility: "private" | "link" | "workspace"
    createdBy: text("created_by").notNull(),
    workspaceId: text("workspace_id").notNull().default("default"),
    topic: text("topic"),
    goal: text("goal"),
    style: text("style").notNull().default("smart"),
    authMode: text("auth_mode").notNull().default("anonymous"),
    recordingConfig: text("recording_config").notNull().default("transcript"),
    maxDurationSec: integer("max_duration_sec").notNull().default(300),
    expiresAt: text("expires_at"), // ISO string or null
    maxUses: integer("max_uses"), // null = unlimited
    uses: integer("uses").notNull().default(0),
    status: text("status").notNull().default("active"), // "active" | "revoked" | "expired"
    tokenHash: text("token_hash").notNull(), // SHA-256 hex; plaintext never stored
    language: text("language").notNull().default("en"),
    scheduledAt: text("scheduled_at"), // ISO string or null
    scheduledGuestEmail: text("scheduled_guest_email"),
    mode: text("mode").notNull().default("live"), // "live" | "async"
    asyncQuestions: text("async_questions"), // JSON array or null
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("share_links_blog_idx").on(t.blogId),
    uniqueIndex("share_links_token_hash_idx").on(t.tokenHash),
    index("share_links_blog_created_by_idx").on(t.blogId, t.createdBy),
    index("share_links_blog_status_idx").on(t.blogId, t.status),
  ],
);

/**
 * interview_events — one row per realtime interview event.
 *
 * Replaces the Firestore `interviews/{id}/events` subcollection.
 *
 * `ts` is an ISO-8601 string (e.g. "2026-05-22T17:51:28.453Z") stored as
 * TEXT so lexicographic ordering is equivalent to chronological ordering —
 * this preserves the Last-Event-ID cursor semantics the SSE stream and the
 * original Firestore query relied on.
 *
 * Cursor correctness across same-millisecond ts collisions is achieved by
 * a compound cursor (ts, id) in `listEventsSince`. The compound ORDER BY
 * `ts ASC, id ASC` produces a stable total order even when multiple events
 * share the same millisecond-precision ISO timestamp, and the WHERE clause
 * `ts > ? OR (ts = ? AND id > ?)` advances the cursor past the last-seen id
 * so no event is ever dropped or double-emitted across poll boundaries.
 *
 * `created_at` is epoch-ms for time-range queries; `ts` is the user-facing
 * event timestamp used as the SSE event id.
 */
export const interviewEvents = sqliteTable(
  "interview_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull(),
    interviewId: text("interview_id").notNull(),
    kind: text("kind").notNull(),
    ts: text("ts").notNull(), // ISO-8601, lexicographically sortable
    payload: text("payload").notNull(), // JSON string
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [
    // Primary streaming query: list events for an interview ordered by time.
    index("interview_events_blog_iv_ts_idx").on(t.blogId, t.interviewId, t.ts),
    // Kind-filtered streaming (SSE + aggregate-usage).
    index("interview_events_blog_iv_kind_ts_idx").on(
      t.blogId,
      t.interviewId,
      t.kind,
      t.ts,
    ),
  ],
);

/**
 * async_responses — one row per question response in an async interview.
 *
 * Replaces the Firestore `interviews/{id}/async_responses/{questionId}`
 * subcollection. UNIQUE (interview_id, question_id) mirrors the Firestore
 * doc-per-questionId upsert semantics: re-answering a question overwrites
 * the previous recording rather than appending a duplicate.
 *
 * `audio_storage_path` holds the Firebase Storage path (e.g.
 * `interviews/{id}/responses/{questionId}.webm`). The audio bytes remain in
 * Firebase Storage until the R2 migration slice (TODO(M2-R2)).
 *
 * Timestamps are epoch-ms integers.
 */
export const asyncResponses = sqliteTable(
  "async_responses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull(),
    interviewId: text("interview_id").notNull(),
    questionId: text("question_id").notNull(),
    audioStoragePath: text("audio_storage_path").notNull(),
    transcript: text("transcript").notNull(),
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [
    // Tenant + interview scoped list (stitcher query).
    index("async_responses_blog_iv_idx").on(t.blogId, t.interviewId),
    // Enforce one row per (interview, question) — upsert on re-submit.
    uniqueIndex("async_responses_iv_q_idx").on(t.interviewId, t.questionId),
  ],
);

/**
 * magic_links — one row per magic-link token issued for a share-link.
 *
 * Replaces the Firestore `shareLinks/{id}/magic_links/{mlHash}` subcollection.
 * `token_hash` is the SHA-256 hex digest of the plaintext magic-link code and
 * is the natural lookup key (plaintext is never stored here).
 *
 * Single-use atomicity is enforced by a conditional UPDATE … WHERE
 * consumed_at IS NULL … RETURNING — if 0 rows are updated, the token was
 * already consumed.
 *
 * `expires_at` is stored as an ISO-8601 string (compatible with Date
 * construction) so the route can compare it to `new Date()` without
 * conversion. Timestamps are epoch-ms integers except where noted.
 */
export const magicLinks = sqliteTable(
  "magic_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull(),
    shareLinkId: text("share_link_id").notNull(),
    tokenHash: text("token_hash").notNull(), // SHA-256 hex; plaintext never stored
    email: text("email"), // null only if the route omits it (current impl always sets it)
    expiresAt: text("expires_at"), // ISO-8601 string
    consumedAt: integer("consumed_at"), // epoch-ms; null = not yet claimed
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [
    uniqueIndex("magic_links_token_hash_idx").on(t.tokenHash),
    index("magic_links_blog_sl_idx").on(t.blogId, t.shareLinkId),
  ],
);

/**
 * interview_session_locks — one row per interview (1:1 singleton).
 *
 * Models the `session_locks/current` sub-document. Primary key is
 * interview_id so a single UPSERT atomically claims or refreshes the lock.
 */
export const interviewSessionLocks = sqliteTable(
  "interview_session_locks",
  {
    interviewId: text("interview_id").primaryKey(),
    blogId: text("blog_id").notNull().default("default"),
    heartbeatId: text("heartbeat_id").notNull(),
    lastBeatAt: integer("last_beat_at").notNull(), // epoch-ms
  },
  (t) => [index("interview_session_locks_blog_idx").on(t.blogId)],
);
