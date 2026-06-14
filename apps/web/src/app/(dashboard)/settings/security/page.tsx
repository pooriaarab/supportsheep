"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Switch } from "@repo/ui/primitives/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Badge } from "@repo/ui/primitives/badge";
import { Plus, X, Shield, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecuritySettings {
  allowedDomains: string[];
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  allowedDomains: [],
  mfaRequired: false,
  sessionTimeoutMinutes: 10080,
};

async function fetchSettings(): Promise<SecuritySettings> {
  const res = await fetch("/api/v1/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  const json = await res.json();
  return {
    allowedDomains: json.data?.security?.allowedDomains ?? DEFAULT_SECURITY_SETTINGS.allowedDomains,
    mfaRequired: json.data?.security?.mfaRequired ?? DEFAULT_SECURITY_SETTINGS.mfaRequired,
    sessionTimeoutMinutes: json.data?.security?.sessionTimeoutMinutes ?? DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
  };
}

async function saveSecuritySettings(settings: SecuritySettings): Promise<void> {
  const res = await fetch("/api/v1/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ security: settings }),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();
  const [domainInput, setDomainInput] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.settings.detail("security"),
    queryFn: fetchSettings,
  });

  const [localSettings, setLocalSettings] = useState<SecuritySettings | null>(null);

  // Use local overrides while editing, fall back to fetched data
  const current = localSettings ?? settings ?? DEFAULT_SECURITY_SETTINGS;

  // Sync fetched data into local state when it arrives (only once)
  const settingsKey = settings
    ? JSON.stringify(settings)
    : null;

  if (settings && !localSettings && settingsKey) {
    setLocalSettings(settings);
  }

  const saveMutation = useMutation({
    mutationFn: saveSecuritySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Security settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const updateField = useCallback(
    <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
      setLocalSettings((prev) => ({ ...(prev ?? DEFAULT_SECURITY_SETTINGS), [key]: value }));
    },
    [],
  );

  const addDomain = useCallback(() => {
    let domain = domainInput.trim().toLowerCase();
    if (!domain) return;
    if (!domain.startsWith("@")) domain = `@${domain}`;
    if (current.allowedDomains.includes(domain)) {
      toast.error("Domain already added");
      return;
    }
    updateField("allowedDomains", [...current.allowedDomains, domain]);
    setDomainInput("");
  }, [domainInput, current.allowedDomains, updateField]);

  const removeDomain = useCallback(
    (domain: string) => {
      updateField(
        "allowedDomains",
        current.allowedDomains.filter((d) => d !== domain),
      );
    },
    [current.allowedDomains, updateField],
  );

  const handleSave = useCallback(() => {
    saveMutation.mutate(current);
  }, [current, saveMutation]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader
          breadcrumbs={[
            { label: "Settings", href: "/settings" },
            { label: "Security" },
          ]}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Security" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-lg bg-background p-6 space-y-6">
            <div className="pb-4 border-b border-border">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Security Settings
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Configure access control and authentication policies
              </p>
            </div>

            {/* Allowed Email Domains */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Allowed Email Domains
                </h4>
              </div>

              <p className="text-sm text-muted-foreground">
                Restrict sign-ups to specific email domains. Leave empty to
                allow any domain.
              </p>

              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="@company.com"
                  className="max-w-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDomain}
                  disabled={!domainInput.trim()}
                >
                  <Plus className="size-4 mr-1" />
                  Add
                </Button>
              </div>

              {current.allowedDomains.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {current.allowedDomains.map((domain) => (
                    <Badge
                      key={domain}
                      variant="secondary"
                      className="gap-1 pl-2.5 pr-1 py-1"
                    >
                      {domain}
                      <button
                        onClick={() => removeDomain(domain)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">
                  No domain restrictions -- any email can sign up.
                </p>
              )}
            </div>

            {/* Authentication */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Authentication
                </h4>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-foreground/80">
                    Require Multi-Factor Authentication
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    All users must set up MFA before accessing the app
                  </p>
                </div>
                <Switch
                  checked={current.mfaRequired}
                  onCheckedChange={(checked) =>
                    updateField("mfaRequired", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-foreground/80">
                    Session Timeout
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    How long sessions remain valid before requiring re-login
                  </p>
                </div>
                <Select
                  value={String(current.sessionTimeoutMinutes)}
                  onValueChange={(val) =>
                    updateField("sessionTimeoutMinutes", Number(val))
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                    <SelectItem value="10080">7 days</SelectItem>
                    <SelectItem value="43200">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
