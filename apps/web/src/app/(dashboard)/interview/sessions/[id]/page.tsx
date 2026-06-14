"use client";

import React, { use, useMemo } from "react";
import { DetailLayout } from "@/components/ui/layout/detail-layout";
import { Card } from "@repo/ui/primitives/card";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";
import { FileText, Clock, DollarSign, ShieldAlert, Mic, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useInterviewCost } from "@/hooks/use-interview-cost-query";
import {
  type InterviewEvent,
  useInterviewEvents,
} from "@/hooks/use-interview-events-query";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `~${m}m${s}s`;
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `~${(count / 1000).toFixed(1)}k`;
  }
  return `${count}`;
}

/**
 * Five-second poll cadence when the session is live so the transcript +
 * cost tabs stay current without a long-lived SSE subscription. Idle/ended
 * sessions stop refetching to avoid pointless Firestore reads.
 */
const LIVE_REFETCH_INTERVAL_MS = 5_000;

function isLive(status: string | undefined): boolean {
  return status === "live";
}

export default function InterviewSessionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: userProfile, isLoading: isProfileLoading } = useUserQuery(currentUser?.uid ?? "");

  const showCostDetails = useMemo(() => {
    if (!userProfile) return false;
    const role = userProfile.role;
    // Owner is a superset of admin — both can view full session details.
    return role === "admin" || role === "owner";
  }, [userProfile]);

  // First fetch lands with no refetchInterval so we don't pin the polling
  // cadence to a stale `live` reading; once `status` is known, TanStack
  // Query re-evaluates the refetchInterval callback on each tick and the
  // poll stops automatically when the session transitions to `ended`.
  const { data: costData, isLoading: isCostLoading } = useInterviewCost(id, {
    enabled: showCostDetails,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return isLive(status) ? LIVE_REFETCH_INTERVAL_MS : false;
    },
  });

  const sessionStatus = costData?.status ?? "loading";

  const { data: transcriptEvents, isLoading: isTranscriptLoading } = useInterviewEvents(
    id,
    {
      enabled: showCostDetails,
      refetchInterval: isLive(sessionStatus) ? LIVE_REFETCH_INTERVAL_MS : false,
      limit: 100,
    },
  );

  // Role check: Only administrator can view session detail client side
  const isAuthorized = useMemo(() => {
    if (isProfileLoading) return true; // prevent flicker
    if (!userProfile) return false;
    const role = userProfile.role;
    // Owner is a superset of admin — both can view full session details.
    return role === "admin" || role === "owner";
  }, [userProfile, isProfileLoading]);

  const chronologicalTranscript = useMemo(
    () =>
      (transcriptEvents ?? []).filter(
        (e: InterviewEvent) =>
          e.kind === "transcript_user" || e.kind === "transcript_ai",
      ),
    [transcriptEvents],
  );

  if (isProfileLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Checking admin permissions...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ShieldAlert}
          title="Access Denied"
          description="You must be an administrator or editor to access interview sessions."
          action={{
            label: "Back to links",
            onClick: () => router.push("/interview/links"),
          }}
        />
      </div>
    );
  }

  const transcriptTabContent = (
    <div className="space-y-4 max-w-3xl">
      {isTranscriptLoading && chronologicalTranscript.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Loading transcript...</p>
      ) : chronologicalTranscript.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No transcript captured yet"
          description={
            isLive(sessionStatus)
              ? "Waiting for the first transcribed turn. New utterances will appear here as they arrive."
              : "This session ended without any persisted transcript events."
          }
        />
      ) : (
        <Card className="p-6">
          <ul className="space-y-4">
            {chronologicalTranscript.map((e) => {
              const isUser = e.kind === "transcript_user";
              const text = ((e.payload as { text?: string })?.text ?? "").trim();
              if (!text) return null;
              const Icon = isUser ? Mic : Bot;
              return (
                <li
                  key={e.id}
                  className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{isUser ? "Guest" : "Interviewer"}</span>
                    <span aria-hidden>·</span>
                    <span>{new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground rounded-tl-none"
                    }`}
                  >
                    {text}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );

  const metricsTabContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Duration & Metrics</h4>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Total talk time:</span>
            <span className="font-medium text-foreground">
              {isCostLoading || !costData ? "—" : formatDuration(costData.durationSec)}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Transcript turns:</span>
            <span className="font-medium text-foreground">
              {chronologicalTranscript.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <StatusBadge
              status={
                sessionStatus === "live"
                  ? "active"
                  : sessionStatus
              }
            />
          </div>
        </div>
      </Card>

      {showCostDetails && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Session Cost Details</h4>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            {isCostLoading ? (
              <div className="text-muted-foreground italic text-sm">Loading cost metrics...</div>
            ) : !costData ? (
              <div className="text-muted-foreground italic text-sm">Failed to load cost metrics</div>
            ) : (
              <>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Total actual cost:</span>
                  <span className="font-semibold text-foreground">${costData.costUsd.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Realtime (OpenAI):</span>
                  <span className="font-medium text-foreground">
                    ${costData.breakdown.realtimeCostUsd.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Writer (Claude):</span>
                  <span className="font-medium text-foreground">
                    ${costData.breakdown.writerCostUsd.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Realtime tokens:</span>
                  <span className="font-medium text-foreground">{formatTokens(costData.realtimeTokens)} tokens</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Writer tokens:</span>
                  <span className="font-medium text-foreground">{formatTokens(costData.writerTokens)} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual duration:</span>
                  <span className="font-medium text-foreground">{formatDuration(costData.durationSec)}</span>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <DetailLayout
      backHref="/interview/links"
      backLabel="Share links"
      title={`Session: ${id}`}
      subtitle={`Status: ${sessionStatus}`}
      tabs={[
        { value: "transcript", label: "Transcript", content: transcriptTabContent },
        { value: "metrics", label: "Metrics & Costs", content: metricsTabContent },
      ]}
    />
  );
}
