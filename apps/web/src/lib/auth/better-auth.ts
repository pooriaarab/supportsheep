import "server-only";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { getDbRaw } from "@/db";
import { account, session, user, verification } from "@/db/schema/auth";

import { isEmailAllowed } from "./email-allowlist";
import { sendMagicLinkEmail } from "./send-magic-link-email";

let cached: ReturnType<typeof betterAuth> | null = null;

/**
 * Lazily build the Better Auth instance. The drizzle adapter needs the D1 binding
 * from `getCloudflareContext()`, which is only available at request time — building
 * it at module load makes Next's build-time page-data collection throw. So this is
 * called per request (the route is `force-dynamic`) and memoized per isolate.
 */
export function getAuth(): ReturnType<typeof betterAuth> {
  if (cached) return cached;
  cached = betterAuth({
    database: drizzleAdapter(getDbRaw(), {
      provider: "sqlite",
      // D1 does not support drizzle's interactive transactions.
      transaction: false,
      schema: { user, session, account, verification },
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Defense-in-depth against open-redirect: only allow post-auth redirects
    // (magic-link callbackURL etc.) to our own origin. The client also guards
    // returnTo (see safe-return-to.ts), but never trust the client alone.
    trustedOrigins: process.env.BETTER_AUTH_URL
      ? [process.env.BETTER_AUTH_URL]
      : [],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (!isEmailAllowed(email)) {
            // Reject before any usable link is delivered. Closes open sign-up:
            // Magic-link sign-up is otherwise unrestricted; the email-domain
            // allowlist is enforced here.
            throw new APIError("FORBIDDEN", {
              message: "This email domain is not permitted to sign in.",
            });
          }
          await sendMagicLinkEmail({ email, url });
        },
      }),
      nextCookies(),
    ],
  });
  return cached;
}
