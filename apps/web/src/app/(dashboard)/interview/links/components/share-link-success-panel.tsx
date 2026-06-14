"use client";

import React, { useState } from "react";
import { Label } from "@repo/ui/primitives/label";
import { Input } from "@repo/ui/primitives/input";
import { Button } from "@repo/ui/primitives/button";
import { AlertTriangle, Copy, Check, Linkedin, Mail, Twitter } from "lucide-react";
import { toast } from "sonner";

interface ShareLinkSuccessPanelProps {
  /** Plaintext share token, only available once at creation/regenerate time. */
  token: string;
  /** Optional topic shown in the prefilled social share copy. */
  topic?: string | null;
}

function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `/interview/join/${token}`;
  return `${window.location.origin}/interview/join/${token}`;
}

function buildShareText(topic: string | null | undefined): string {
  return topic
    ? `I'm running a short AI-led interview about "${topic}". Join here:`
    : "I'd love to interview you for a short AI-led conversation. Join here:";
}

export function ShareLinkSuccessPanel({
  token,
  topic,
}: ShareLinkSuccessPanelProps) {
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(token);
  const shareText = buildShareText(topic);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Copied! Share link URL copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Couldn't copy. Select the field and copy manually.`);
    }
  };

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(url)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url,
  )}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(
    topic ? `Interview invite: ${topic}` : "Interview invite",
  )}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`;

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
        <Label className="text-xs font-semibold text-primary">
          Guest invite URL
        </Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={url}
            className="bg-background select-all"
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          />
          <Button
            onClick={handleCopy}
            size="icon"
            variant="outline"
            className="shrink-0"
            aria-label="Copy URL"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0 text-warning" />
          <span>
            This is a <strong>one-time visible plaintext link</strong>. It
            cannot be viewed or fetched again after closing. Use Regenerate
            from the share link menu to rotate it.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Share via
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={xHref} target="_blank" rel="noopener noreferrer">
              <Twitter className="h-4 w-4" />X
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={linkedinHref} target="_blank" rel="noopener noreferrer">
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={emailHref}>
              <Mail className="h-4 w-4" />
              Email
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
