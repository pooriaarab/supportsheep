"use client";

import React, { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@repo/ui/composites/responsive-dialog";
import { Label } from "@repo/ui/primitives/label";
import { Input } from "@repo/ui/primitives/input";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Button } from "@repo/ui/primitives/button";
import { Switch } from "@repo/ui/primitives/switch";
import { useCreateShareLink } from "@/hooks/use-share-links-query";
import { useBlogConfigQuery } from "@/hooks/use-blog-config-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShareLinkSuccessPanel } from "./share-link-success-panel";

import { ShareVisibilitySection } from "./sections/share-visibility-section";
import { ShareStyleSection } from "./sections/share-style-section";
import { ShareRecordingSection } from "./sections/share-recording-section";
import { ShareDurationSection } from "./sections/share-duration-section";
import { ShareAuthSection } from "./sections/share-auth-section";
import { ShareExpirySection } from "./sections/share-expiry-section";
import { ShareLanguageSection } from "./sections/share-language-section";
import type {
  ShareLinkVisibility,
  InterviewStyle,
  RecordingConfig,
  AuthMode,
  ShareLinkCreateInput,
  InterviewLanguage,
} from "@/lib/interviews/share-link-schema";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopic?: string;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  initialTopic = "",
}: ShareLinkDialogProps) {
  const [createdData, setCreatedData] = useState<{
    id: string;
    token: string;
    topic: string | null;
  } | null>(null);

  const { data: blogConfig, isLoading: isConfigLoading } = useBlogConfigQuery();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          // Reset success state on close so it is fresh next time
          setCreatedData(null);
        }
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {createdData ? "Share link created!" : "Create share link"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {createdData
              ? "Your invite link is ready. Send it to your guest to start the interview."
              : "Configure what the interview is, who can join, and what gets captured."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {createdData ? (
          <div className="space-y-6 py-2">
            <ShareLinkSuccessPanel
              token={createdData.token}
              topic={createdData.topic}
            />
            <ResponsiveDialogFooter className="pt-2 sm:justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : isConfigLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          open && (
            <ShareLinkFormInner
              key={`${open}-${initialTopic}-${blogConfig?.blogId ?? "loading"}`}
              initialTopic={initialTopic}
              defaultStyle={blogConfig?.interview?.defaultStyle ?? "smart"}
              defaultRecordingConfig={(blogConfig?.interview?.defaultRecording === "video" ? "transcript" : blogConfig?.interview?.defaultRecording as RecordingConfig) ?? "transcript"}
              defaultDurationSec={blogConfig?.interview?.defaultDurationSec ?? 300}
              defaultLanguage={blogConfig?.interview?.defaultLanguage ?? "en"}
              onCancel={() => onOpenChange(false)}
              onSuccess={setCreatedData}
            />
          )
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

interface ShareLinkFormInnerProps {
  initialTopic: string;
  onCancel: () => void;
  onSuccess: (data: { id: string; token: string; topic: string | null }) => void;
  defaultStyle: InterviewStyle;
  defaultRecordingConfig: RecordingConfig;
  defaultDurationSec: number;
  defaultLanguage: InterviewLanguage;
}

function ShareLinkFormInner({
  initialTopic,
  onCancel,
  onSuccess,
  defaultStyle,
  defaultRecordingConfig,
  defaultDurationSec,
  defaultLanguage,
}: ShareLinkFormInnerProps) {
  const [type, setType] = useState<ShareLinkVisibility>("link");
  const [topic, setTopic] = useState(initialTopic);
  const [goal, setGoal] = useState("");
  const [style, setStyle] = useState<InterviewStyle>(defaultStyle);
  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>(defaultRecordingConfig);
  const [authMode, setAuthMode] = useState<AuthMode>("email");
  const [maxDurationSec, setMaxDurationSec] = useState(defaultDurationSec);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [language, setLanguage] = useState<InterviewLanguage>(defaultLanguage);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledGuestEmail, setScheduledGuestEmail] = useState("");

  const createLink = useCreateShareLink();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic is required");
      return;
    }

    if (isScheduled) {
      if (!scheduledAt) {
        toast.error("Scheduled date and time is required");
        return;
      }
      if (!scheduledGuestEmail.trim()) {
        toast.error("Guest email is required");
        return;
      }
    }

    try {
      const input: ShareLinkCreateInput = {
        type,
        // V2.3 async mode made `mode` a required field on
        // ShareLinkCreateInput. The full-create dialog is live-flow only
        // today; async links are minted via the async UI which has its
        // own form. Default to "live" so the existing flow keeps working.
        mode: "live",
        topic,
        style,
        recordingConfig,
        authMode: type === "link" ? authMode : "anonymous",
        maxDurationSec,
        maxUses,
        language,
      };

      if (goal.trim()) {
        input.goal = goal;
      }
      if (expiresAt) {
        input.expiresAt = expiresAt;
      }

      if (isScheduled && scheduledAt) {
        input.scheduledAt = new Date(scheduledAt).toISOString();
        if (scheduledGuestEmail.trim()) {
          input.scheduledGuestEmail = scheduledGuestEmail.trim();
        }
      }

      const res = await createLink.mutateAsync(input);
      onSuccess({ ...res, topic: topic || null });
    } catch {
      // Handled in mutation hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      {/* 1. Visibility */}
      <ShareVisibilitySection value={type} onChange={setType} />

      {/* 2. Gate (Only Link visibility) */}
      {type === "link" && (
        <ShareAuthSection value={authMode} onChange={setAuthMode} />
      )}

      {/* 3. Topic & Goal */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">What it&apos;s about</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full-topic">Topic</Label>
          <Input
            id="full-topic"
            placeholder="Why you switched from Notion to Supportsheep"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full-goal">Goal (optional)</Label>
          <Textarea
            id="full-goal"
            placeholder="What do you want this interview to produce? E.g. a 600-word testimonial focusing on time saved."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <div className="text-[11px] text-muted-foreground">
            If left blank with smart style, the AI asks the guest at the start.
          </div>
        </div>
      </div>

      {/* 4. Style */}
      <ShareStyleSection value={style} onChange={setStyle} />

      {/* 5. Recording config */}
      <ShareRecordingSection value={recordingConfig} onChange={setRecordingConfig} />

      {/* 6. Duration */}
      <ShareDurationSection value={maxDurationSec} onChange={setMaxDurationSec} />

      {/* 6b. Language */}
      <ShareLanguageSection value={language} onChange={setLanguage} />

      {/* 7. Validity */}
      <ShareExpirySection
        expiresAt={expiresAt}
        onExpiresAtChange={setExpiresAt}
        maxUses={maxUses}
        onMaxUsesChange={setMaxUses}
      />

      {/* 8. Schedule Interview */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-foreground">Schedule Interview</h3>
            <p className="text-xs text-muted-foreground">
              Schedule this interview for a future date and time.
            </p>
          </div>
          <Switch
            checked={isScheduled}
            onCheckedChange={(checked) => {
              setIsScheduled(checked);
              if (!checked) {
                setScheduledAt("");
                setScheduledGuestEmail("");
              }
            }}
          />
        </div>

        {isScheduled && (
          <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduled-at">Date & Time</Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required={isScheduled}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduled-guest-email">Guest Email</Label>
              <Input
                id="scheduled-guest-email"
                type="email"
                placeholder="guest@example.com"
                value={scheduledGuestEmail}
                onChange={(e) => setScheduledGuestEmail(e.target.value)}
                required={isScheduled}
              />
              <p className="text-[11px] text-muted-foreground">
                We will email a calendar invite (.ics) to this address immediately.
              </p>
            </div>
          </div>
        )}
      </div>

      <ResponsiveDialogFooter className="pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={createLink.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createLink.isPending} className="flex gap-2">
          {createLink.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create link
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}
