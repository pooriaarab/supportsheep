import "server-only";

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { user } from "@/db/schema/auth";
import { blogMembers } from "@/db/schema/tenancy";
import { createApiKey } from "@/lib/api-keys/repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:signup-codes:provision");

type DB = DrizzleD1Database<typeof schema>;

export interface ProvisionedAgent {
  userId: string;
  apiKey: string;
  keyPreview: string;
}

/**
 * Resolve (or create) a Better Auth user for `email`, ensure they are a member
 * of `blogId` with `role`, and mint a fresh owner-scoped API key for them.
 *
 * Called only after a signup code has been successfully redeemed, so the code
 * itself is the email verification — a newly created user is marked
 * emailVerified. The Better Auth `user` table is written directly via drizzle
 * (no interactive auth API), mirroring how tenancy/members reads it.
 *
 * Membership insert is idempotent (onConflictDoNothing) so re-running for an
 * existing member is a no-op on the membership but still mints a new key.
 */
export async function provisionAgentAccount(
  input: { email: string; name?: string; blogId: string; role: string },
  db: DB = getDb(),
): Promise<ProvisionedAgent> {
  const email = input.email.toLowerCase();

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    userId = nanoid();
    await db.insert(user).values({
      id: userId,
      name: input.name ?? email,
      email,
      // The redeemed code is the verification: the agent was authorized by an
      // admin, so the account is created already-verified.
      emailVerified: true,
    });
    log.info("Created agent user", { userId, blogId: input.blogId });
  }

  await db
    .insert(blogMembers)
    .values({ blogId: input.blogId, userId, role: input.role })
    .onConflictDoNothing({
      target: [blogMembers.blogId, blogMembers.userId],
    });

  const key = await createApiKey(
    userId,
    input.blogId,
    { name: `agent:${email}`, scopes: ["read", "write"] },
    db,
  );

  return { userId, apiKey: key.key, keyPreview: key.keyPreview };
}
