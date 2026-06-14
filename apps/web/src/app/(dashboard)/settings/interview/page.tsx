"use client";

/**
 * Settings > Interview
 *
 * Configure default style, duration, recording mode, mint permissions, monthly cost caps, and retention.
 */

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlogConfigQuery } from "@/hooks/use-blog-config-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";
import { Checkbox } from "@repo/ui/primitives/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { BlogConfig, InterviewStyle } from "@repo/types";

const DEFAULT_ROLES: ("owner" | "admin" | "editor")[] = ["owner", "admin", "editor"];

async function updateBlogConfig(
  data: Record<string, unknown>,
): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || "Failed to update blog config");
  }
  const json = await res.json();
  return json.data;
}

export default function InterviewSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useBlogConfigQuery();

  const [defaultStyle, setDefaultStyle] = useState<InterviewStyle | null>(null);
  const [defaultDurationSec, setDefaultDurationSec] = useState<number | null>(null);
  const [defaultRecording, setDefaultRecording] = useState<"transcript" | "audio" | "video" | null>(null);
  const [whoCanMintLinks, setWhoCanMintLinks] = useState<("owner" | "admin" | "editor")[] | null>(null);
  const [monthlyCostCapUsd, setMonthlyCostCapUsd] = useState<string | null>(null);
  const [audioDays, setAudioDays] = useState<number | null>(null);
  const [transcriptDays, setTranscriptDays] = useState<number | null>(null);

  const currentStyle = defaultStyle ?? config?.interview?.defaultStyle ?? "smart";
  const currentDurationSec = defaultDurationSec ?? config?.interview?.defaultDurationSec ?? 300;
  const currentRecording = defaultRecording ?? config?.interview?.defaultRecording ?? "transcript";
  const currentWhoCanMintLinks = useMemo(() => {
    return whoCanMintLinks ?? config?.interview?.whoCanMintLinks ?? DEFAULT_ROLES;
  }, [whoCanMintLinks, config?.interview?.whoCanMintLinks]);
  const currentMonthlyCostCapUsd = monthlyCostCapUsd ?? (config?.interview?.monthlyCostCapUsd !== undefined ? (config.interview.monthlyCostCapUsd === null ? "" : String(config.interview.monthlyCostCapUsd)) : "");
  const currentAudioDays = audioDays ?? config?.interview?.retention?.audioDays ?? 90;
  const currentTranscriptDays = transcriptDays ?? config?.interview?.retention?.transcriptDays ?? 365;

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogConfig.all,
      });
      toast.success("Interview settings updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update settings");
    },
  });

  const handleRoleToggle = useCallback((role: "owner" | "admin" | "editor", checked: boolean) => {
    let nextRoles = [...currentWhoCanMintLinks];
    if (checked) {
      if (!nextRoles.includes(role)) {
        nextRoles.push(role);
      }
    } else {
      nextRoles = nextRoles.filter((r) => r !== role);
    }
    setWhoCanMintLinks(nextRoles);
  }, [currentWhoCanMintLinks]);

  const handleSave = useCallback(() => {
    const costCap = currentMonthlyCostCapUsd.trim() === "" ? null : parseInt(currentMonthlyCostCapUsd, 10);
    mutation.mutate({
      interview: {
        defaultStyle: currentStyle,
        defaultDurationSec: currentDurationSec,
        defaultRecording: currentRecording,
        whoCanMintLinks: currentWhoCanMintLinks,
        monthlyCostCapUsd: costCap === null || isNaN(costCap) ? null : costCap,
        retention: {
          audioDays: currentAudioDays,
          transcriptDays: currentTranscriptDays,
        },
      },
    });
  }, [
    mutation,
    currentStyle,
    currentDurationSec,
    currentRecording,
    currentWhoCanMintLinks,
    currentMonthlyCostCapUsd,
    currentAudioDays,
    currentTranscriptDays,
  ]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min${mins > 1 ? "s" : ""}`;
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Interview Workspace" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Interview Workspace Settings
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Configure workspace-level defaults for AI-led interviews
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section 1: Defaults */}
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-foreground">Interview Defaults</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultStyle">Default Style</Label>
                      <Select
                        value={currentStyle}
                        onValueChange={(val) => setDefaultStyle(val as InterviewStyle)}
                      >
                        <SelectTrigger id="defaultStyle">
                          <SelectValue placeholder="Select Style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smart">Smart (Dynamic)</SelectItem>
                          <SelectItem value="testimonial">Testimonial</SelectItem>
                          <SelectItem value="eeat">E-E-A-T Profile</SelectItem>
                          <SelectItem value="case_study">Case Study</SelectItem>
                          <SelectItem value="qa">Q&A</SelectItem>
                          <SelectItem value="launch">Product Launch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultRecording">Recording Mode</Label>
                      <Select
                        value={currentRecording}
                        onValueChange={(val) => setDefaultRecording(val as "transcript" | "audio" | "video")}
                      >
                        <SelectTrigger id="defaultRecording">
                          <SelectValue placeholder="Select Recording Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transcript">Transcript Only</SelectItem>
                          <SelectItem value="audio">Audio + Transcript</SelectItem>
                          <SelectItem value="video">Video + Audio (Gated)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="defaultDuration">Default Duration</Label>
                      <span className="text-sm font-medium text-muted-foreground">
                        {formatDuration(currentDurationSec)}
                      </span>
                    </div>
                    <input
                      id="defaultDuration"
                      type="range"
                      min={60}
                      max={1800}
                      step={60}
                      value={currentDurationSec}
                      onChange={(e) => setDefaultDurationSec(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 min</span>
                      <span>10 min</span>
                      <span>20 min</span>
                      <span>30 min</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Permissions */}
                <div className="pt-4 border-t border-border space-y-4">
                  <h4 className="text-base font-medium text-foreground">Mint Permissions</h4>
                  <p className="text-sm text-muted-foreground">
                    Define who can mint new interview share links in this workspace
                  </p>
                  
                  <div className="space-y-2">
                    <Label>Who Can Mint Share Links</Label>
                    <div className="flex flex-col gap-3 mt-2 sm:flex-row sm:gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-owner"
                          checked={currentWhoCanMintLinks.includes("owner")}
                          onCheckedChange={(checked) => handleRoleToggle("owner", !!checked)}
                        />
                        <Label htmlFor="role-owner" className="font-normal cursor-pointer">Workspace Owner</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-admin"
                          checked={currentWhoCanMintLinks.includes("admin")}
                          onCheckedChange={(checked) => handleRoleToggle("admin", !!checked)}
                        />
                        <Label htmlFor="role-admin" className="font-normal cursor-pointer">Administrator</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-editor"
                          checked={currentWhoCanMintLinks.includes("editor")}
                          onCheckedChange={(checked) => handleRoleToggle("editor", !!checked)}
                        />
                        <Label htmlFor="role-editor" className="font-normal cursor-pointer">Editor</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Cost Cap */}
                <div className="pt-4 border-t border-border space-y-4">
                  <h4 className="text-base font-medium text-foreground">Monthly Cost Cap</h4>
                  <p className="text-sm text-muted-foreground">
                    Set a budget limit. Leave blank to disable the budget cap.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="monthlyCostCap">Monthly Cost Cap (USD)</Label>
                    <Input
                      id="monthlyCostCap"
                      type="number"
                      placeholder="e.g. 500 (No limit if blank)"
                      value={currentMonthlyCostCapUsd}
                      onChange={(e) => setMonthlyCostCapUsd(e.target.value)}
                      min={0}
                    />
                  </div>
                </div>

                {/* Section 4: Retention */}
                <div className="pt-4 border-t border-border space-y-4">
                  <h4 className="text-base font-medium text-foreground">Retention Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Set how long recorded transcripts and audio files should be kept before purging.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="audioDays">Audio Retention (Days)</Label>
                      <Input
                        id="audioDays"
                        type="number"
                        value={currentAudioDays}
                        onChange={(e) => setAudioDays(parseInt(e.target.value, 10) || 0)}
                        min={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="transcriptDays">Transcript Retention (Days)</Label>
                      <Input
                        id="transcriptDays"
                        type="number"
                        value={currentTranscriptDays}
                        onChange={(e) => setTranscriptDays(parseInt(e.target.value, 10) || 0)}
                        min={1}
                      />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-6 border-t border-border flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="gap-2"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
