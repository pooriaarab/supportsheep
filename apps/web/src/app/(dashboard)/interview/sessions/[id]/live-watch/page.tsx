import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getInterview } from "@/lib/interviews/interviews-repository";
import {
  DEFAULT_BLOG_ID,
  getMembershipByUser,
} from "@/lib/tenancy/repository";
import { verifyRequest } from "@/lib/auth/session";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { AlertCircle } from "lucide-react";
import { LiveWatchClient } from "./live-watch-client";
import {
  buildInterviewTokenCookie,
  mintInterviewToken,
} from "@/lib/interviews/interview-token";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LiveWatchPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Authenticate server-side
  let session;
  try {
    session = await verifyRequest();
  } catch (_err) {
    redirect("/login");
  }

  // 2. Authorize - resolve the caller's blog role.
  const membership = await getMembershipByUser(session.uid);
  const role = membership?.role;

  if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <EmptyState
          icon={AlertCircle}
          title="Access Denied"
          description="You do not have administrative permissions to watch this interview live."
          variant="error"
        />
      </div>
    );
  }

  // 3. Fetch interview
  const interviewData = await getInterview(DEFAULT_BLOG_ID, id);
  if (!interviewData) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <EmptyState
          icon={AlertCircle}
          title="Interview not found"
          description="The requested interview session does not exist."
          variant="error"
        />
      </div>
    );
  }

  const interview = {
    id,
    topic: interviewData.topic || "general discussion",
    style: interviewData.style || "smart",
    status: interviewData.status || "consent",
  };

  // Mint the interview token + set it as an HttpOnly cookie scoped to
  //    `/api/v1/interviews/<id>`. The SSE stream + admin canvas-edit
  //    fetches issued by `LiveWatchClient` pick it up automatically as
  //    a same-origin cookie — no need to thread it through the URL.
  const interviewToken = mintInterviewToken(id);
  const cookie = buildInterviewTokenCookie(id, interviewToken);
  const cookieStore = await cookies();
  cookieStore.set({
    name: cookie.name,
    value: cookie.value,
    ...cookie.options,
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Admin Watch</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor the running conversation and suggest follow-up questions for the host.
        </p>
      </div>

      <LiveWatchClient interview={interview} />
    </div>
  );
}
