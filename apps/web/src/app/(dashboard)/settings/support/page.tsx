"use client";

/**
 * Settings > Support
 *
 * Manage AI Voice and Chatbot settings.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Label } from "@repo/ui/primitives/label";
import { Switch } from "@repo/ui/primitives/switch";
import { Button } from "@repo/ui/primitives/button";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Input } from "@repo/ui/primitives/input";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { BlogConfig } from "@repo/types";

export default function SupportSettingsPage() {
  const queryClient = useQueryClient();

  const [localState, setLocalState] = useState<{
    enableVoice: boolean;
    enableChatbot: boolean;
    systemPrompt: string;
    greeting: string;
    initialized: boolean;
  }>({
    enableVoice: false,
    enableChatbot: false,
    systemPrompt: "",
    greeting: "",
    initialized: false,
  });

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: async () => {
      const res = await fetch("/api/blog/config");
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();
      if (!localState.initialized) {
        setLocalState({
          enableVoice: data.support?.enableVoice ?? false,
          enableChatbot: data.support?.enableChatbot ?? false,
          systemPrompt: data.support?.systemPrompt ?? "",
          greeting: data.support?.greeting ?? "",
          initialized: true,
        });
      }
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { support: Omit<typeof localState, "initialized"> }) => {
      const res = await fetch("/api/blog/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save support settings");
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.blogConfig.settings(), updated);
      toast.success("Support settings saved");
    },
    onError: () => {
      toast.error("Failed to save support settings");
    },
  });

  const handleSave = () => {
    const { initialized: _, ...support } = localState;
    updateMutation.mutate({ support });
  };

  if (isLoading || !config) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <PageHeader
          breadcrumbs={[{ label: "Settings", href: "/settings/general" }, { label: "Support Features" }]}
        />
        <div className="space-y-6 mt-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-start">
        <PageHeader
          breadcrumbs={[{ label: "Settings", href: "/settings/general" }, { label: "Support Features" }]}
        />
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="space-y-6 mt-8">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Widgets</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable AI Voice</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to call your AI agent directly from your site.
                </p>
              </div>
              <Switch
                checked={localState.enableVoice}
                onCheckedChange={(c) => setLocalState(s => ({ ...s, enableVoice: c }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Chatbot</Label>
                <p className="text-sm text-muted-foreground">
                  Show the floating support chatbot widget on public pages.
                </p>
              </div>
              <Switch
                checked={localState.enableChatbot}
                onCheckedChange={(c) => setLocalState(s => ({ ...s, enableChatbot: c }))}
              />
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>System Prompt</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Instructions for how the AI should behave, respond, and handle out-of-scope questions.
              </p>
              <Textarea
                value={localState.systemPrompt}
                onChange={(e) => setLocalState(s => ({ ...s, systemPrompt: e.target.value }))}
                placeholder="You are a helpful support assistant..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Welcome Greeting</Label>
              <p className="text-sm text-muted-foreground mb-2">
                The first message the AI will send when a user opens the chat or starts a call.
              </p>
              <Input
                value={localState.greeting}
                onChange={(e) => setLocalState(s => ({ ...s, greeting: e.target.value }))}
                placeholder="Hi there! How can I help you today?"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
