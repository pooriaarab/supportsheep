import { getInterview } from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { ExpiredCard } from "../components/expired-card";
import { InCallLayoutDesktop } from "@/components/interview/in-call-layout-desktop";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    interview?: string;
    ephemeral?: string;
    /** Microphone deviceId selected on the pre-call device picker. */
    mic?: string;
  }>;
}

// The interview HMAC token (30 min TTL) is delivered as an HttpOnly
// cookie scoped to `/api/v1/interviews/<id>` by POST /consent (see
// `buildInterviewTokenCookie`). Same-origin guest API requests pick it
// up automatically — it is never passed in the URL, so it cannot leak
// into browser history, Referer headers, or server access logs.
//
// The OpenAI ephemeral token (60s TTL) is still passed in the URL because
// the realtime client needs it client-side and the TTL is short enough
// that the risk surface is bounded.
export default async function LiveInCallPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const {
    interview: interviewId,
    ephemeral: ephemeralToken,
    mic: audioInputDeviceId,
  } = await searchParams;

  if (!interviewId || !ephemeralToken) {
    return <ExpiredCard />;
  }

  const interviewData = await getInterview(DEFAULT_BLOG_ID, interviewId);
  if (!interviewData) {
    return <ExpiredCard />;
  }

  // Bind the interview to the share-link token in the URL path. Prevents an
  // attacker with a leaked interviewId from accessing the live page of an
  // unrelated share link to view the interview's topic and guest name.
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

  return (
    <InCallLayoutDesktop
      interviewId={interviewId}
      ephemeralOpenAiToken={ephemeralToken}
      topic={interviewData.topic ?? "Guest Interview"}
      guestName={interviewData.guestName ?? "Guest Speaker"}
      maxDurationSeconds={interviewData.maxDurationSec ?? 600}
      audioInputDeviceId={audioInputDeviceId}
    />
  );
}
