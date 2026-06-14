import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Better Auth browser client (magic-link plugin).
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
