"use client";

import type { ShareLinkPublicView } from "@/lib/interviews/share-link-schema";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Calendar } from "lucide-react";

interface Props {
  token: string;
  link: ShareLinkPublicView;
}

export function ScheduledCard({ token, link }: Props) {
  if (!link.scheduledAt) return null;

  const date = new Date(link.scheduledAt);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const durationMin = Math.round(link.maxDurationSec / 60);

  return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <Card className="p-8 shadow-md border border-border bg-card">
        <div className="space-y-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Calendar className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Interview Scheduled
            </h1>
            <p className="text-muted-foreground text-sm">
              This interview has been scheduled and is not yet open.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border/50 text-left space-y-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</span>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formattedDate} at {formattedTime}
              </p>
            </div>

            {link.topic && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic</span>
                <p className="text-sm text-foreground font-medium mt-0.5">{link.topic}</p>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</span>
              <p className="text-sm text-foreground font-medium mt-0.5">~{durationMin} minutes</p>
            </div>
          </div>

          <div className="pt-2">
            <a href={`/api/v1/interviews/share-links/by-token/${token}/calendar`} download className="block w-full">
              <Button size="lg" className="w-full">
                Add to calendar
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
