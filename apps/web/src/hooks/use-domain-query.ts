import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export type DomainStatus = "pending" | "active" | "failed";

export interface DomainGuidance {
  state: "active" | "pending" | "failed";
  userMessage: string;
  fixHint: string | null;
}

export interface DomainState {
  domain: string | null;
  status: DomainStatus | null;
  verifiedAt?: number | null;
  cnameTarget?: string | null;
  ownershipVerification?: {
    type: string;
    name: string;
    value: string;
  } | null;
  /** SSL/certificate status, surfaced distinctly from hostname status. */
  sslStatus?: string | null;
  /** Plain-English failure reason when status is "failed". */
  failureReason?: string | null;
  /** Mapped guidance (user message + fix hint) for the current state. */
  guidance?: DomainGuidance | null;
  /** Note shown when the entered domain is an apex (www is separate). */
  apexNote?: string | null;
  instructions?: string[];
}

export interface SetDomainResult {
  domain: string;
  cnameTarget: string;
  status: DomainStatus;
  ownershipVerification: DomainState["ownershipVerification"];
  apexNote?: string | null;
  instructions: string[];
}

/** Friendly message for a domain API error code, or a generic fallback. */
async function readDomainError(res: Response): Promise<string> {
  let code = "";
  let message = "";
  try {
    const json = (await res.json()) as { error?: string; message?: string };
    code = json.error ?? "";
    message = json.message ?? "";
  } catch {
    // no JSON body
  }
  if (code === "custom_domains_not_configured") {
    return (
      message ||
      "Custom domains are not configured for this environment yet."
    );
  }
  if (code === "domain_taken") return "That domain is already in use.";
  if (code === "domain_reserved")
    return "blogbat.com domains can't be used as a custom domain.";
  if (code === "invalid_domain") return "Enter a valid domain (e.g. blog.example.com).";
  if (code === "cloudflare_error")
    return message || "Cloudflare could not provision the domain. Try again.";
  return message || "Something went wrong. Please try again.";
}

async function fetchDomain(blogId: string): Promise<DomainState> {
  const res = await fetch(`/api/v1/blogs/${blogId}/domain`);
  if (!res.ok) throw new Error(await readDomainError(res));
  return res.json();
}

async function setDomain(
  blogId: string,
  domain: string,
): Promise<SetDomainResult> {
  const res = await fetch(`/api/v1/blogs/${blogId}/domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) throw new Error(await readDomainError(res));
  return res.json();
}

async function removeDomain(blogId: string): Promise<void> {
  const res = await fetch(`/api/v1/blogs/${blogId}/domain`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readDomainError(res));
}

/** How often to re-poll while a domain is still pending (ms). */
const PENDING_POLL_INTERVAL_MS = 10_000;

/**
 * The blog's custom domain + verification status. While the domain is
 * `pending`, the query auto-refetches every 10s (the server refreshes status
 * from Cloudflare on each GET) so the page advances to active/failed on its own
 * — no manual "Check status" needed. Polling stops once the status is terminal.
 */
export function useDomainQuery(blogId: string | null) {
  return useQuery({
    queryKey: queryKeys.domain.detail(blogId ?? ""),
    queryFn: () => fetchDomain(blogId as string),
    enabled: !!blogId,
    refetchInterval: (query) =>
      query.state.data?.status === "pending"
        ? PENDING_POLL_INTERVAL_MS
        : false,
  });
}

/** Provision a custom domain for the blog. */
export function useSetDomainMutation(blogId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => setDomain(blogId as string, domain),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.domain.detail(blogId ?? ""),
      });
    },
  });
}

/** Remove the blog's custom domain. */
export function useRemoveDomainMutation(blogId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeDomain(blogId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.domain.detail(blogId ?? ""),
      });
    },
  });
}
