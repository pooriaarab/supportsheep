import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  consentToLive,
  getInterview,
} from "@/lib/interviews/interviews-repository";
import { getBlogConfig } from "@/lib/blog-config";
import { DEFAULT_blog_id, getMembershipByUser } from "@/lib/tenancy/repository";
import { getBlogMember } from "@/lib/tenancy/members";
import { verifyRequest } from "@/lib/auth/session";
import { buildSystemPrompt } from "@/lib/interviews/system-prompts";
import {
  buildInterviewTokenCookie,
  mintInterviewToken,
} from "@/lib/interviews/interview-token";
import { mintRealtimeSession, CANVAS_TOOLS } from "@/lib/interviews/openai-realtime";
import { InCallLayoutDesktop } from "@/components/interview/in-call-layout-desktop";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { AlertCircle } from "lucide-react";
import { createLogger } from "@/lib/logger";
import { getInterviewAccess } from "@/lib/interviews/interview-access";
import type { UserRole } from "@repo/types";

const log = createLogger("interviews:author-live");

interface PageProps {
  params: Promise<{ id: string }>;
}

function ExpiredCard() {
  return (
    <div className="max-w-lg mx-auto mt-12">
      <EmptyState
        icon={AlertCircle}
        title="Interview not found or inactive"
        description="This interview is no longer active, completed, or you are not authorized to access it."
        variant="error"
      />
    </div>
  );
}

export default async function AuthorLivePage({ params }: PageProps) {
  const { id: interviewId } = await params;

  // 1. Authenticate the author server-side
  let session;
  try {
    session = await verifyRequest();
  } catch (_err) {
    redirect("/login");
  }

  // 2. Fetch the interview record (D1)
  const interviewData = await getInterview(DEFAULT_blog_id, interviewId);
  if (!interviewData) {
    return <ExpiredCard />;
  }

  // 3. RBAC resource query — allows the self-flow creator, the workspace
  //    owner/admin, AND the share-link creator who joined their own link
  //    (this is the common "author tests their own share link" flow that
  //    used to 404 against the older startedByUid-only check).
  const membership = await getMembershipByUser(session.uid);
  const role = (membership?.role ?? "guest") as UserRole;
  const member = membership
    ? await getBlogMember(membership.blogId, session.uid)
    : null;
  const access = await getInterviewAccess(interviewData, {
    uid: session.uid,
    email: session.email ?? null,
    role,
    workspaceId: "default",
  });
  if (!access) {
    return <ExpiredCard />;
  }

  // 4. Lifecycle: only allow if status is 'consent' or 'live'
  if (interviewData.status !== "consent" && interviewData.status !== "live") {
    return <ExpiredCard />;
  }

  // 5. Atomic state transition if status is 'consent'. Mirrors the guest
  //    consent route: the conditional UPDATE only flips a row still in
  //    consent, so concurrent author/guest joins can't double-start.
  if (interviewData.status === "consent") {
    const config = await getBlogConfig();
    const monthlyCostCapUsd = config?.interview?.monthlyCostCapUsd ?? null;
    const transition = await consentToLive(
      DEFAULT_blog_id,
      interviewId,
      monthlyCostCapUsd,
    );
    if (!transition.ok) {
      log.error("Failed to transition interview status to live", {
        interviewId,
        reason: transition.reason,
      });
      return <ExpiredCard />;
    }
  }

  // 6. Mint the internal HMAC interview token and set it as an HttpOnly
  //    cookie scoped to `/api/v1/interviews/<id>` BEFORE any further async
  //    work. Next.js App Router only permits cookie mutations from a
  //    Server Component while the response is still buffered — once a
  //    long-running upstream `await` (e.g. the OpenAI realtime mint
  //    below) starts streaming, `cookieStore.set` throws and the page
  //    returns a 500. Mirrors the /consent path used by guests so all
  //    interview API requests (events, session-lock, canvas-snapshot,
  //    end, SSE stream) authenticate the same way.
  const interviewToken = mintInterviewToken(interviewId);
  const cookie = buildInterviewTokenCookie(interviewId, interviewToken);
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
    });
  } catch (err: unknown) {
    log.error("Failed to set interview token cookie", {
      interviewId,
      uid: session.uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return (
      <div className="max-w-lg mx-auto mt-12">
        <EmptyState
          icon={AlertCircle}
          title="Connection error"
          description="Failed to initialize the interview session. Please refresh and try again."
          variant="error"
        />
      </div>
    );
  }

  // 7. Use the member profile already fetched in step 3 for display name
  const guestName = member?.name ?? session.email?.split("@")[0] ?? "Author";

  // 8. Build the system prompt
  const instructions = buildSystemPrompt({
    style: interviewData.style,
    topic: interviewData.topic,
    goal: interviewData.goal,
    language: interviewData.language,
  });

  // 9. Mint the OpenAI realtime session (must run AFTER cookies().set —
  //    see comment on step 6).
  let realtimeSession;
  try {
    realtimeSession = await mintRealtimeSession({
      voice: "alloy",
      instructions,
      tools: [...CANVAS_TOOLS],
      language: interviewData.language,
    });
  } catch (err: unknown) {
    log.error("Failed to mint OpenAI realtime session for author", {
      interviewId,
      uid: session.uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return (
      <div className="max-w-lg mx-auto mt-12">
        <EmptyState
          icon={AlertCircle}
          title="Connection error"
          description="Failed to initialize the interview audio stream. Please try again, or check the function logs if the problem persists."
          variant="error"
        />
      </div>
    );
  }

  return (
    <InCallLayoutDesktop
      interviewId={interviewId}
      ephemeralOpenAiToken={realtimeSession.client_secret.value}
      topic={interviewData.topic ?? "Author Interview"}
      guestName={guestName}
      maxDurationSeconds={interviewData.maxDurationSec ?? 300}
    />
  );
}

export const dynamic = "force-dynamic";
