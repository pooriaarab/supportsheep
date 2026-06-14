/**
 * Firestore Collection Names
 *
 * Single source of truth for all collection names used across the monorepo.
 * Import from "@repo/shared" to avoid hardcoded strings.
 */

export const COLLECTIONS = {
  users: "users",
  items: "items",
  tasks: "tasks",
  auditLogs: "audit_logs",
  settings: "settings",
  integrations: "integrations",
  apiKeys: "api_keys",
  templates: "templates",
  notifications: "notifications",
  sessions: "sessions",
  aiChatMessages: "ai_chat_messages",
  aiChatThreads: "ai_chat_threads",
  freeTools: "free_tools",
  freeToolUsage: "free_tool_usage",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
