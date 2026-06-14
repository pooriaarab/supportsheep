import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  mintInterviewToken,
  buildInterviewTokenCookie,
} from "@/lib/interviews/interview-token";

/**
 * Admin-only endpoint that mints a fresh interview token and sets the
 * scoped HttpOnly cookie so an admin can open the live-watch SSE stream
 * without the token ever travelling in a URL (F-006). The guest flow sets
 * the cookie via /consent; this route is the equivalent priming step for
 * the dashboard live-watch view, which never visits /consent.
 *
 * Returns 204 on success — the cookie is the only side effect a caller
 * should rely on. The token value is intentionally NOT echoed in the
 * response body so it cannot accidentally end up in JS console logs or
 * fetch-response breadcrumbs.
 */
export const POST = createApiHandler({
  auth: "user",
  handler: async ({ params, role }) => {
    const { id } = params as { id: string };

    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const token = mintInterviewToken(id);
    const response = new NextResponse(null, { status: 204 });
    const cookie = buildInterviewTokenCookie(id, token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  },
});
