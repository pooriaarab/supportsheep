import { getInterview } from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { ExpiredCard } from "../components/expired-card";
import { ConsentForm } from "./components/consent-form";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ interview?: string }>;
}

export default async function GuestConsentPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { interview: interviewId } = await searchParams;

  if (!interviewId) {
    return <ExpiredCard />;
  }

  // Direct D1 read on the Server Component for speed and reliability.
  const interviewData = await getInterview(DEFAULT_BLOG_ID, interviewId);
  if (!interviewData) {
    return <ExpiredCard />;
  }

  // Bind the interview to the share-link token from the URL path.
  // Prevents a leaked interviewId from being usable on the consent screen of
  // an unrelated share link.
  if (!interviewData.shareLinkId) {
    return <ExpiredCard />;
  }
  const tokenHash = hashShareLinkToken(token);
  const slData = await getShareLink(DEFAULT_BLOG_ID, interviewData.shareLinkId);
  if (!slData) {
    return <ExpiredCard />;
  }
  if (slData.tokenHash !== tokenHash) {
    return <ExpiredCard />;
  }

  // Security & lifecycle check: Ensure this is indeed a guest interview and status is "consent"
  if (interviewData.status !== "consent") {
    // If it's already live or ended, redirect directly to live page
    return (
      <div className="max-w-md mx-auto mt-20 px-4 text-center space-y-4">
        <h1 className="text-xl font-bold">Interview session active</h1>
        <p className="text-muted-foreground text-sm">
          This interview session is already in progress or has been completed.
        </p>
      </div>
    );
  }

  return (
    <ConsentForm
      token={token}
      interviewId={interviewId}
      recordingConfig={interviewData.recordingConfig}
      topic={interviewData.topic || null}
      maxDurationSec={interviewData.maxDurationSec}
    />
  );
}

export const dynamic = "force-dynamic";
