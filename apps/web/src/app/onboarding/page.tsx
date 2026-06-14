import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { verifyRequest } from "@/lib/auth/session";
import { getMembershipByUser } from "@/lib/tenancy/repository";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata: Metadata = {
  title: "Create your blog",
  description: "Set up your blog to get started.",
  robots: { index: false, follow: false },
};

/**
 * Onboarding lives outside the (dashboard) route group so it is not subject to
 * the dashboard's "no membership → redirect to /onboarding" guard (which would
 * otherwise loop). It is also not covered by middleware's PROTECTED_PREFIXES,
 * so we gate it here: unauthenticated users go to /login, and users who already
 * have a blog skip straight to the dashboard.
 */
export default async function OnboardingPage() {
  let session;
  try {
    session = await verifyRequest();
  } catch {
    redirect("/login?returnTo=/onboarding");
  }

  const membership = await getMembershipByUser(session.uid);
  if (membership) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
