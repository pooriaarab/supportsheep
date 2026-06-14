import { getShareLinkByTokenHash } from "@/lib/interviews/share-links-repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import type { ShareLinkPublicView } from "@/lib/interviews/share-link-schema";
import { LandingCard } from "./components/landing-card";
import { ExpiredCard } from "./components/expired-card";
import { ScheduledCard } from "./components/scheduled-card";
import { cookies } from "next/headers";
import { verifySessionCached } from "@/lib/auth/session";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function resolveShareLink(token: string): Promise<ShareLinkPublicView | null> {
  if (!token || token.length < 32) return null;
  const hash = hashShareLinkToken(token);
  const doc = await getShareLinkByTokenHash(hash);

  if (!doc) return null;

  if (doc.status !== "active") return null;
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null;
  if (doc.maxUses !== null && doc.uses >= doc.maxUses) return null;

  return {
    topic: doc.topic,
    goal: doc.goal,
    style: doc.style,
    recordingConfig: doc.recordingConfig,
    maxDurationSec: doc.maxDurationSec,
    authMode: doc.authMode,
    type: doc.type,
    status: doc.status,
    language: doc.language || "en",
    scheduledAt: doc.scheduledAt ?? null,
    mode: doc.mode || "live",
  };
}

export default async function GuestLandingPage({ params }: PageProps) {
  const { token } = await params;
  const link = await resolveShareLink(token);

  if (!link) {
    return <ExpiredCard />;
  }

  if (link.scheduledAt && new Date(link.scheduledAt) > new Date()) {
    return <ScheduledCard token={token} link={link} />;
  }

  if (link.type === "workspace") {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");
    const session = sessionCookie ? await verifySessionCached(sessionCookie.value).catch(() => null) : null;

    if (!session) {
      redirect(`/login?returnTo=${encodeURIComponent(`/i/${token}`)}`);
    }
  }

  return <LandingCard token={token} link={link} />;
}

export const dynamic = "force-dynamic";
