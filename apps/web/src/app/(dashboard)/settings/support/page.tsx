"use client";

/**
 * Settings > Support
 *
 * Manage AI Voice and Chatbot settings.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Label } from "@repo/ui/primitives/label";
import { Switch } from "@repo/ui/primitives/switch";
import { Input } from "@repo/ui/primitives/input";
import { Button } from "@repo/ui/primitives/button";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { BlogConfig } from "@repo/types";

export default function SupportSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: async () => {
      const res = await fetch("/api/blog/config");
      if (!res.ok) throw new Error("Failed to load config");
      return res.json();
    },
  });

  const [saving, setSaving] = useState(false);

  // Local state mirrored from config to allow editing
  const [localState, setLocalState] = useState<{
    enableVoice: boolean;
    enableChatbot: boolean;
    openAIApiKey: string;
  }>({
    enableVoice: false,
    enableChatbot: false,
    openAIApiKey: "",
  });

  // Sync local state when config loads
  // Using a separate effect or just memoizing helps, but for simplicity
  // we'll just update it in the mutation or use a derived state approach.
  // Actually, we'll initialize on mount/data fetch.
  // Wait, the standard way in this app is probably updating state on load.
  // Let's use a simpler approach: controlled inputs based on local state synced from query.
  
  const handleLoad = useCallback((loadedConfig: BlogConfig) => {
      setLocalState({
          enableVoice: loadedConfig.support?.enableVoice ?? false,
          enableChatbot: loadedConfig.support?.enableChatbot ?? false,
          openAIApiKey: loadedConfig.support?.openAIApiKey ?? "",
      })
  }, []);

  useQuery<BlogConfig>({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: async () => {
      const res = await fetch("/api/blog/config");
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();
      handleLoad(data);
      return data;
    },
    enabled: !config,
  });


  const updateMutation = useMutation({
    mutationFn: async (payload: { support: typeof localState }) => {
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
      setSaving(false);
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to save support settings");
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateMutation.mutate({ support: localState });
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">AI Providers</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>OpenAI API Key (Required for Voice)</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={localState.openAIApiKey}
                onChange={(e) => setLocalState(s => ({ ...s, openAIApiKey: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Your OpenAI API key to power the real-time voice agent.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}