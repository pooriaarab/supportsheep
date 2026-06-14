import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ShareLinkCreateInput } from "@/lib/interviews/share-link-schema";

const QUERY_KEY = ["share-links"] as const;

export interface ShareLinkSummary {
  id: string;
  type: "private" | "link" | "workspace";
  topic: string | null;
  goal: string | null;
  style: string;
  recordingConfig: "transcript" | "audio";
  maxDurationSec: number;
  authMode: "anonymous" | "email" | "magic_link";
  status: "active" | "revoked" | "expired";
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

async function fetchShareLinks(): Promise<ShareLinkSummary[]> {
  const res = await fetch("/api/v1/interviews/share-links");
  if (!res.ok) throw new Error("Failed to fetch share links");
  const json = (await res.json()) as { data: ShareLinkSummary[] };
  return json.data;
}

export function useShareLinksQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchShareLinks });
}

export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShareLinkCreateInput) => {
      const res = await fetch("/api/v1/interviews/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      return (await res.json()) as { id: string; token: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Share link created");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create share link";
      toast.error(msg);
    },
  });
}

export function useRegenerateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/v1/interviews/share-links/${id}/regenerate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to regenerate share link");
      }
      return (await res.json()) as { id: string; token: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Share link regenerated. Old URL is now invalid.");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to regenerate share link";
      toast.error(msg);
    },
  });
}

export function useRevokeShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/interviews/share-links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke share link");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Share link revoked");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to revoke share link";
      toast.error(msg);
    },
  });
}
