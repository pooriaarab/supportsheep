import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { GoogleIntegrationProvider } from "@/lib/integrations/google-integration";

export type IntegrationType = "oauth" | "api_key" | "webhook";
export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  description: string;
  icon: string;
  connectedAt?: string | number | null;
  config?: Record<string, string | number | boolean | undefined> & {
    provider?: GoogleIntegrationProvider;
    measurementId?: string;
    propertyId?: string;
    siteUrl?: string;
    redirectUri?: string;
    oauthClientSecretPreview?: string;
    oauth?: {
      connected?: boolean;
      tokenType?: string;
      scope?: string;
      expiryDate?: number;
    };
  };
}

async function fetchIntegrations(): Promise<Integration[]> {
  const res = await fetch("/api/v1/integrations");
  if (!res.ok) throw new Error("Failed to fetch integrations");
  const json = await res.json();
  return json.data;
}

async function connectIntegration(
  data: Pick<Integration, "name" | "type"> & {
    description?: string;
    config?: Record<string, string | undefined>;
  },
): Promise<Integration> {
  const res = await fetch("/api/v1/integrations", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to connect integration");
  return res.json();
}

async function disconnectIntegration(id: string): Promise<void> {
  const res = await fetch(`/api/v1/integrations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "disconnected" }),
  });
  if (!res.ok) throw new Error("Failed to disconnect integration");
}

async function startGoogleOAuth(integrationId: string): Promise<{
  authorizationUrl: string;
}> {
  const res = await fetch("/api/v1/integrations/google/start", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrationId }),
  });
  if (!res.ok) throw new Error("Failed to start Google authorization");
  return res.json();
}

async function deleteIntegrations(ids: string[]): Promise<void> {
  const res = await fetch("/api/v1/integrations", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to delete integrations");
}

export function useIntegrationsQuery() {
  return useQuery({
    queryKey: queryKeys.integrations.lists(),
    queryFn: fetchIntegrations,
  });
}

export function useConnectIntegrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

export function useDisconnectIntegrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

export function useStartGoogleOAuthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startGoogleOAuth,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

export function useDeleteIntegrationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIntegrations,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}
