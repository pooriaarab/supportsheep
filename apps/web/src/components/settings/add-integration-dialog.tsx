"use client";

import type { FormEvent } from "react";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { ArrowLeft, Search, Plug } from "lucide-react";
import {
  useConnectIntegrationMutation,
  useStartGoogleOAuthMutation,
} from "@/hooks/use-integrations-query";
import type { IntegrationType } from "@/hooks/use-integrations-query";
import type { GoogleIntegrationProvider } from "@/lib/integrations/google-integration";
import { WebhookCreationResult } from "@/components/settings/webhook-creation-result";
import { toast } from "sonner";

type ProviderCategory =
  | "communication"
  | "development"
  | "analytics"
  | "payment"
  | "other";

interface AvailableProvider {
  id: string;
  name: string;
  type: IntegrationType;
  provider?: GoogleIntegrationProvider;
  category: ProviderCategory;
  description: string;
  icon: string;
}

const AVAILABLE_PROVIDERS: AvailableProvider[] = [
  {
    id: "slack",
    name: "Slack",
    type: "oauth",
    category: "communication",
    description: "Send notifications and receive commands via Slack channels.",
    icon: "S",
  },
  {
    id: "github",
    name: "GitHub",
    type: "oauth",
    category: "development",
    description: "Sync repositories, track issues, and automate deployments.",
    icon: "G",
  },
  {
    id: "linear",
    name: "Linear",
    type: "oauth",
    category: "development",
    description: "Sync issues, track sprints, and manage project workflows.",
    icon: "L",
  },
  {
    id: "stripe",
    name: "Stripe",
    type: "api_key",
    category: "payment",
    description: "Process payments, manage subscriptions, and track revenue.",
    icon: "S",
  },
  {
    id: "sentry",
    name: "Sentry",
    type: "api_key",
    category: "analytics",
    description: "Monitor errors and performance issues in real-time.",
    icon: "E",
  },
  {
    id: "google-analytics-4",
    name: "Google Analytics 4",
    type: "oauth",
    provider: "google_analytics",
    category: "analytics",
    description: "Track public blog traffic and sync GA4 reporting metrics.",
    icon: "A",
  },
  {
    id: "google-search-console",
    name: "Google Search Console",
    type: "oauth",
    provider: "google_search_console",
    category: "analytics",
    description: "Sync search queries, clicks, impressions, and positions.",
    icon: "G",
  },
  {
    id: "resend",
    name: "Resend",
    type: "api_key",
    category: "other",
    description:
      "Send transactional and marketing emails with deliverability tracking.",
    icon: "R",
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    type: "webhook",
    category: "other",
    description:
      "Receive published articles from Outrank or any tool that can POST JSON to a webhook.",
    icon: "W",
  },
];

const CATEGORY_TABS: { value: "all" | ProviderCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "communication", label: "Communication" },
  { value: "development", label: "Development" },
  { value: "analytics", label: "Analytics" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Other" },
];

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddIntegrationDialog({
  open,
  onOpenChange,
}: AddIntegrationDialogProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<AvailableProvider | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    "all" | ProviderCategory
  >("all");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [measurementId, setMeasurementId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [createdWebhook, setCreatedWebhook] = useState<{
    endpointUrl: string;
    token: string;
  } | null>(null);
  const connectMutation = useConnectIntegrationMutation();
  const startGoogleOAuthMutation = useStartGoogleOAuthMutation();

  const redirectUri = useMemo(() => {
    if (typeof window === "undefined") {
      return "/api/v1/integrations/google/callback";
    }
    return `${window.location.origin}/api/v1/integrations/google/callback`;
  }, []);

  const isGoogleProvider = Boolean(selectedProvider?.provider);

  const resetForm = () => {
    setSelectedProvider(null);
    setBrowseSearch("");
    setActiveCategory("all");
    setName("");
    setApiKey("");
    setOauthClientId("");
    setOauthClientSecret("");
    setMeasurementId("");
    setPropertyId("");
    setSiteUrl("");
    setCreatedWebhook(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const filteredProviders = useMemo(() => {
    let result = AVAILABLE_PROVIDERS;
    if (activeCategory !== "all") {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (browseSearch.trim()) {
      const query = browseSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query));
    }
    return result;
  }, [browseSearch, activeCategory]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !name.trim()) return;

    const config: Record<string, string> = {};
    if (selectedProvider.type === "api_key" && apiKey.trim()) {
      config.apiKey = apiKey.trim();
    }
    if (selectedProvider.provider) {
      config.provider = selectedProvider.provider;
      config.oauthClientId = oauthClientId.trim();
      config.oauthClientSecret = oauthClientSecret.trim();
      if (selectedProvider.provider === "google_analytics") {
        config.measurementId = measurementId.trim();
        config.propertyId = propertyId.trim();
      } else {
        config.siteUrl = siteUrl.trim();
      }
    }

    try {
      const result = await connectMutation.mutateAsync({
        name: name.trim(),
        type: selectedProvider.type,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      if (selectedProvider.provider) {
        const { authorizationUrl } = await startGoogleOAuthMutation.mutateAsync(
          result.id,
        );
        window.location.href = authorizationUrl;
        return;
      }

      if (
        selectedProvider.type === "webhook" &&
        typeof result.config?.endpointUrl === "string" &&
        typeof result.config?.token === "string"
      ) {
        setCreatedWebhook({
          endpointUrl: result.config.endpointUrl,
          token: result.config.token,
        });
        return;
      }

      toast.success(`${name.trim()} connected successfully`);
      handleOpenChange(false);
    } catch {
      toast.error("Failed to connect integration");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {createdWebhook ? (
          <WebhookCreationResult
            endpointUrl={createdWebhook.endpointUrl}
            token={createdWebhook.token}
            onDone={() => handleOpenChange(false)}
          />
        ) : !selectedProvider ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Integration</DialogTitle>
              <DialogDescription>
                Choose a service to connect to your workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={browseSearch}
                  onChange={(e) => setBrowseSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveCategory(tab.value)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeCategory === tab.value
                        ? "bg-foreground text-background"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                {filteredProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(provider);
                      setName(provider.name);
                    }}
                    className="flex flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-ring hover:shadow-sm transition-[border-color,box-shadow]"
                  >
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-foreground">
                        {provider.icon}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">
                      {provider.name}
                    </span>
                  </button>
                ))}
                {filteredProviders.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Plug className="size-8 mb-2 opacity-40" />
                    <p className="text-sm">No integrations found</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 shrink-0"
                  onClick={() => setSelectedProvider(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div>
                  <DialogTitle>Connect {selectedProvider.name}</DialogTitle>
                  <DialogDescription>
                    {selectedProvider.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isGoogleProvider && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Google OAuth setup
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>
                      Create a Web application OAuth client in Google Cloud.
                    </li>
                    <li>
                      Add this redirect URI to the authorized redirect URIs.
                    </li>
                    <li>Paste the client ID and client secret below.</li>
                  </ol>
                  <div className="mt-3 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground break-all">
                    {redirectUri}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="integration-name">Display Name</Label>
                <Input
                  id="integration-name"
                  placeholder={`e.g., ${selectedProvider.name} Production`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={connectMutation.isPending}
                />
              </div>

              {selectedProvider.type === "api_key" && (
                <div className="space-y-2">
                  <Label htmlFor="integration-api-key">API Key</Label>
                  <Input
                    id="integration-api-key"
                    type="password"
                    placeholder="Enter your API key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={connectMutation.isPending}
                  />
                </div>
              )}

              {selectedProvider.type === "oauth" && !isGoogleProvider && (
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    You will be redirected to {selectedProvider.name} to
                    authorize access. After authorization, you will be returned
                    here automatically.
                  </p>
                </div>
              )}

              {isGoogleProvider && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="google-oauth-client-id">
                      OAuth Client ID
                    </Label>
                    <Input
                      id="google-oauth-client-id"
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      disabled={connectMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-oauth-client-secret">
                      OAuth Client Secret
                    </Label>
                    <Input
                      id="google-oauth-client-secret"
                      type="password"
                      placeholder="Enter the Google OAuth client secret"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      disabled={connectMutation.isPending}
                    />
                  </div>
                </>
              )}

              {selectedProvider.provider === "google_analytics" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ga4-measurement-id">
                      GA4 Measurement ID
                    </Label>
                    <Input
                      id="ga4-measurement-id"
                      placeholder="G-XXXXXXXXXX"
                      value={measurementId}
                      onChange={(e) => setMeasurementId(e.target.value)}
                      disabled={connectMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ga4-property-id">GA4 Property ID</Label>
                    <Input
                      id="ga4-property-id"
                      placeholder="123456789"
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      disabled={connectMutation.isPending}
                    />
                  </div>
                </>
              )}

              {selectedProvider.provider === "google_search_console" && (
                <div className="space-y-2">
                  <Label htmlFor="gsc-site-url">Search Console Site URL</Label>
                  <Input
                    id="gsc-site-url"
                    placeholder="https://blogbat.com/"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    disabled={connectMutation.isPending}
                  />
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={connectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !name.trim() ||
                    connectMutation.isPending ||
                    startGoogleOAuthMutation.isPending ||
                    (isGoogleProvider &&
                      (!oauthClientId.trim() ||
                        !oauthClientSecret.trim() ||
                        (selectedProvider.provider === "google_analytics" &&
                          (!measurementId.trim() || !propertyId.trim())) ||
                        (selectedProvider.provider ===
                          "google_search_console" &&
                          !siteUrl.trim())))
                  }
                >
                  {connectMutation.isPending ||
                  startGoogleOAuthMutation.isPending
                    ? "Connecting..."
                    : isGoogleProvider
                      ? "Continue to Google"
                      : "Connect"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
