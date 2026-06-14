"use client";

/**
 * AI Chat Configuration -- system prompt, model, temperature, and token settings.
 *
 * Settings are persisted to Firestore via the settings API (/settings/ai_chat document)
 * and read by the AI chat endpoint when processing messages.
 */

import { useState, useCallback } from "react";
import { Save, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { toast } from "sonner";
import { useMountEffect } from "@/hooks/use-mount-effect";

export interface AiChatSettings {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SETTINGS: AiChatSettings = {
  systemPrompt:
    "You are a helpful AI assistant. Provide clear, concise, and well-structured responses.",
  model: "claude-sonnet-4-6",
  temperature: 0.7,
  maxTokens: 1024,
};

const MODELS = [
  { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

export function AiChatConfig() {
  const [settings, setSettings] = useState<AiChatSettings>(DEFAULT_SETTINGS);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useMountEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch("/api/v1/ai/chat/config");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.data) {
            setSettings({ ...DEFAULT_SETTINGS, ...json.data });
          }
        }
      } catch {
        // Fall back to defaults on error
      } finally {
        if (!cancelled) setIsLoadingConfig(false);
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  });

  const update = useCallback((patch: Partial<AiChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setIsSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/ai/chat/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Save failed" }));
        toast.error(json.error ?? "Failed to save settings");
        return;
      }
      setIsSaved(true);
      toast.success("AI chat settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/ai/chat/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_SETTINGS),
      });
      if (res.ok) {
        setSettings(DEFAULT_SETTINGS);
        setIsSaved(true);
        toast.success("Settings reset to defaults");
      } else {
        toast.error("Failed to reset settings");
      }
    } catch {
      toast.error("Failed to reset settings");
    } finally {
      setIsSaving(false);
    }
  }, []);

  if (isLoadingConfig) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading AI settings…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="system-prompt" className="text-sm font-medium">
          System Prompt
        </Label>
        <Textarea
          id="system-prompt"
          value={settings.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={5}
          className="text-sm resize-y"
          placeholder="Instructions that shape how the AI assistant behaves…"
        />
        <p className="text-xs text-muted-foreground">
          This prompt is sent as the system instruction for every AI chat
          message.
        </p>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <Label htmlFor="model" className="text-sm font-medium">
          Model
        </Label>
        <Select
          value={settings.model}
          onValueChange={(value) => update({ model: value })}
        >
          <SelectTrigger id="model" className="w-full sm:w-64">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature" className="text-sm font-medium">
            Temperature
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {settings.temperature.toFixed(1)}
          </span>
        </div>
        <input
          id="temperature"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.temperature}
          onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
          className="w-full sm:w-64 accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Lower values produce more focused responses. Higher values increase
          creativity.
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <Label htmlFor="max-tokens" className="text-sm font-medium">
          Max Tokens
        </Label>
        <Input
          id="max-tokens"
          type="number"
          min={64}
          max={4096}
          step={64}
          value={settings.maxTokens}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n))
              update({ maxTokens: Math.min(4096, Math.max(64, n)) });
          }}
          className="w-full sm:w-40"
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of tokens the AI can generate per response (64 - 4096).
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          size="sm"
          className="gap-1.5"
          disabled={isSaving || isSaved}
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Save Settings
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-1.5"
          disabled={isSaving}
        >
          <RotateCcw className="size-3.5" />
          Reset to Defaults
        </Button>
        {!isSaved && (
          <span className="text-xs text-warning">Unsaved changes</span>
        )}
        {isSaved && (
          <span className="text-xs text-muted-foreground">
            All changes saved
          </span>
        )}
      </div>
    </div>
  );
}
