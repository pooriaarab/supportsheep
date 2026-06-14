import { getInterview } from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { ExpiredCard } from "../../components/expired-card";
import { InCallLayoutDesktop } from "@/components/interview/in-call-layout-desktop";
import React from "react";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    interview?: string;
    tavusUrl?: string;
    ephemeral?: string;
    /** Microphone deviceId selected on the pre-call device picker. */
    mic?: string;
  }>;
}

const ALLOWED_TAVUS_HOSTS = ["tavusapi.com", "tavus.io", "daily.co"];

function isAllowedTavusUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_TAVUS_HOSTS.some(
      (suffix) =>
        parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export default async function LiveVideoInCallPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const {
    interview: interviewId,
    tavusUrl,
    ephemeral: ephemeralToken,
    mic: audioInputDeviceId,
  } = await searchParams;

  if (!interviewId || !tavusUrl || !ephemeralToken) {
    return <ExpiredCard />;
  }

  if (!isAllowedTavusUrl(tavusUrl)) {
    return <ExpiredCard />;
  }

  const interviewData = await getInterview(DEFAULT_BLOG_ID, interviewId);
  if (!interviewData) {
    return <ExpiredCard />;
  }

  // Bind the interview to the share-link token in the URL path.
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
      tavusUrl={tavusUrl}
    />
  );
}
