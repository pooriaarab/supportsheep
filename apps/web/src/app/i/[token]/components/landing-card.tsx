"use client";

import { useState } from "react";
import type { ShareLinkPublicView } from "@/lib/interviews/share-link-schema";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { EmailGateForm } from "./email-gate-form";
import { MagicLinkForm } from "./magic-link-form";

interface Props {
  token: string;
  link: ShareLinkPublicView;
}

export function LandingCard({ token, link }: Props) {
  const durationMin = Math.round(link.maxDurationSec / 60);

  // Map presentation style to a friendly string
  const styleDisplayMap: Record<string, string> = {
    testimonial: "Customer Testimonial",
    eeat: "E-E-A-T Case Study",
    case_study: "Success Story / Case Study",
    qa: "Q&A Session",
    launch: "Product Launch Interview",
    smart: "Smart AI Interviewer",
  };

  return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <Card className="p-8 shadow-md border border-border bg-card">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              You&apos;ve been invited to an AI interview
            </h1>
            {link.topic ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Topic: <span className="font-medium text-foreground">{link.topic}</span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Join a dynamic AI-led conversation.
              </p>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
            <h2 className="text-sm font-semibold text-foreground mb-3">Interview details</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium text-foreground">~{durationMin} minutes</span>
              </li>
              <li className="flex justify-between">
                <span>Recording:</span>
                <span className="font-medium text-foreground">
                  {link.recordingConfig === "audio" ? "Audio + transcript" : "Transcript only"}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Style:</span>
                <span className="font-medium text-foreground">
                  {styleDisplayMap[link.style] || link.style}
                </span>
              </li>
            </ul>
          </div>

          {link.authMode === "anonymous" && <AnonymousJoin token={token} />}
          {link.authMode === "email" && <EmailGateForm token={token} />}
          {link.authMode === "magic_link" && <MagicLinkForm token={token} />}
        </div>
      </Card>
    </div>
  );
}

function AnonymousJoin({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareLinkToken: token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to join interview");
      }

      const { interviewId } = (await res.json()) as { interviewId: string };
      window.location.href = `/i/${token}/consent?interview=${interviewId}`;
    } catch (err: unknown) {
      const errorWithMessage = err as { message?: string };
      setError(errorWithMessage.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
          {error}
        </div>
      )}
      <Button onClick={onJoin} size="lg" className="w-full" disabled={loading}>
        {loading ? "Joining..." : "Join interview"}
      </Button>
    </div>
  );
}
