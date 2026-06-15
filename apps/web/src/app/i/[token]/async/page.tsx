import {
  getShareLinkByTokenHash,
  type ShareLinkRow,
} from "@/lib/interviews/share-links-repository";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { buildRecordingFileUrl } from "@/lib/interviews/recording-access";
import { ExpiredCard } from "../components/expired-card";
import { AsyncInterviewClient } from "./components/async-interview-client";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ interview?: string }>;
}

async function resolveShareLink(token: string): Promise<ShareLinkRow | null> {
  if (!token || token.length < 32) return null;
  const hash = hashShareLinkToken(token);
  const doc = await getShareLinkByTokenHash(hash);

  if (!doc) return null;
  if (doc.status !== "active") return null;
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null;
  if (doc.maxUses !== null && doc.uses >= doc.maxUses) return null;

  return doc;
}

export default async function AsyncGuestPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { interview: interviewId } = await searchParams;

  if (!interviewId) {
    return <ExpiredCard />;
  }

  // 1. Resolve share link and ensure it is in async mode
  const link = await resolveShareLink(token);
  if (!link || link.mode !== "async") {
    return <ExpiredCard />;
  }

  // 2. Resolve interview
  const interviewData = await getInterview(DEFAULT_blog_id, interviewId);
  if (!interviewData) {
    return <ExpiredCard />;
  }

  // 3. Security validation: Cross-verify shareLinkId and mode
  if (
    interviewData.shareLinkId !== link.id ||
    interviewData.mode !== "async" ||
    (interviewData.status !== "live" && interviewData.status !== "consent")
  ) {
    return <ExpiredCard />;
  }

  // 4. Build same-origin streaming URLs for each question. The audio bytes are
  // private and served only by the authed recording-file route; the guest's
  // interview-token cookie (path-scoped to /api/v1/interviews/{id}) carries the
  // credentials when the <audio> element loads the URL.
  const rawQuestions = link.asyncQuestions || [];
  const questionsWithUrls = rawQuestions.map((q) => ({
    id: q.id,
    text: q.text,
    audioUrl: buildRecordingFileUrl(interviewId, "question", q.id),
  }));

  return (
    <AsyncInterviewClient
      questions={questionsWithUrls}
      interviewId={interviewId}
      token={token}
    />
  );
}

export const dynamic = "force-dynamic";
