import type { Author } from "@repo/types";

/**
 * Shared named-author catalog used by both server runtime code and offline
 * scripts. Keep this file free of `server-only` imports so Bun scripts can
 * load it directly.
 */
export type AuthorSeed = Omit<Author, "createdAt" | "updatedAt">;

export const NAMED_AUTHORS: readonly AuthorSeed[] = [
  {
    id: "pooria-arab",
    name: "Pooria Arab",
    jobTitle: "",
    bio: "Builds Supportsheep, an AI-powered blog platform for solopreneurs.",
    avatarUrl: "",
    email: "",
    sameAs: ["https://linkedin.com/in/pooriaarab"],
  },
  {
    id: "madison-carter",
    name: "Madison Carter",
    jobTitle: "Contributing Writer",
    bio: "Writes about launching and growing supportsheep businesses online.",
    avatarUrl: "",
    email: "",
    sameAs: [],
  },
] as const;
