import type { Metadata } from "next";

import { AcceptInvite } from "@/components/auth/accept-invite";

export const metadata: Metadata = {
  title: "Accept invite",
  description: "Accept your invitation to join a blog on BlogBat.",
  robots: { index: false, follow: false },
};

/**
 * Accept-invite page. Lives outside the (dashboard) route group so it is not
 * subject to the dashboard's membership guard — accepting the invite is how a
 * recipient gains their first membership. All logic is client-side (reads the
 * token from the query string, requires sign-in, then redeems the invite).
 */
export default function AcceptInvitePage() {
  return <AcceptInvite />;
}
