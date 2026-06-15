"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Loader2, Mic, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type {
  AuthMode,
  ShareLinkPublicView,
} from "@/lib/interviews/share-link-schema";

interface JoinPageProps {
  params: Promise<{ token: string }>;
}

async function fetchPublicShareLink(
  token: string,
): Promise<ShareLinkPublicView> {
  const res = await fetch(
    `/api/v1/interviews/share-links/by-token/${encodeURIComponent(token)}`,
  );
  if (!res.ok) throw new Error("not_found");
  return (await res.json()) as ShareLinkPublicView;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return m === 1 ? "~1 minute" : `~${m} minutes`;
}

export default function InterviewJoinPage({ params }: JoinPageProps) {
  const router = useRouter();
  const { token } = React.use(params);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const linkQuery = useQuery({
    queryKey: ["interview-share-link", token],
    queryFn: () => fetchPublicShareLink(token),
    retry: false,
  });

  if (linkQuery.isLoading) {
    return (
      <Centered>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (linkQuery.isError || !linkQuery.data) {
    return (
      <Centered>
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-10 w-10 text-error" />
          <h1 className="text-lg font-semibold text-foreground">
            Invite link is invalid or has expired
          </h1>
          <p className="text-sm text-muted-foreground">
            This interview invite is no longer available. Ask the host to send
            you a fresh link.
          </p>
        </Card>
      </Centered>
    );
  }

  const link = linkQuery.data;
  const authMode: AuthMode = link.authMode;
  const needsEmail = authMode === "email" || authMode === "magic_link";

  if (magicLinkSentTo) {
    return (
      <Centered>
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <Mic className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to{" "}
            <strong className="text-foreground">{magicLinkSentTo}</strong>.
            Open it to start your interview. The link expires in 15 minutes.
          </p>
        </Card>
      </Centered>
    );
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (needsEmail && !guestEmail.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setSubmitting(true);
    try {
      // Magic-link gate: don't try to create the interview directly.
      // POST to the magic-link send endpoint, then surface a "check your
      // email" confirmation. The link click consumes the magic-link token
      // and creates the interview server-side via GET /magic-link.
      if (authMode === "magic_link") {
        const mlRes = await fetch("/api/v1/interviews/magic-link", {
          method: "Article",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareLinkToken: token,
            email: guestEmail.trim(),
          }),
        });
        const mlBody = await mlRes.json().catch(() => ({}));
        if (!mlRes.ok) {
          toast.error(mlBody?.error ?? "Unable to send sign-in email");
          return;
        }
        setMagicLinkSentTo(guestEmail.trim());
        return;
      }

      const res = await fetch("/api/v1/interviews", {
        method: "Article",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareLinkToken: token,
          guestName: guestName.trim(),
          guestEmail: needsEmail ? guestEmail.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "Unable to start interview");
        return;
      }
      const interviewId = body?.interviewId as string | undefined;
      if (!interviewId) {
        toast.error("Server didn't return an interview id");
        return;
      }
      // Route through the existing public consent → live flow rather than
      // the dashboard live page. The dashboard live page is the AUTHOR's
      // view (gated on startedByUid). Share-link guests own access via the
      // share-link token, so they go through /i/[token]/consent which mints
      // the OpenAI ephemeral session and forwards to /i/[token]/live.
      router.push(`/i/${token}/consent?interview=${interviewId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to start interview",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Centered>
      <Card className="max-w-lg w-full p-8 space-y-6">
        <header className="space-y-2 text-center">
          <Mic className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">
            You&apos;re invited to a voice interview
          </h1>
          {link.topic && (
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Topic:</strong>{" "}
              {link.topic}
            </p>
          )}
          {link.goal && (
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Goal:</strong>{" "}
              {link.goal}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Estimated duration: {formatDuration(link.maxDurationSec)} · Style:{" "}
            {link.style}
          </p>
        </header>

        <form onSubmit={handleStart} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-name">Your name</Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          {needsEmail && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-email">Your email</Label>
              <Input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                The host uses this to attribute your interview. We don&apos;t
                spam.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Start interview
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            We&apos;ll ask for microphone permission on the next screen.
          </p>
        </form>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      {children}
    </div>
  );
}
