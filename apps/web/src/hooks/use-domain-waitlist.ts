import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export interface DomainWaitlistState {
  joined: boolean;
  totalInterested: number;
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string; message?: string };
    return json.message || json.error || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

async function fetchWaitlist(blogId: string): Promise<DomainWaitlistState> {
  const res = await fetch(`/api/v1/blogs/${blogId}/domain/waitlist`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

async function joinWaitlist(blogId: string): Promise<DomainWaitlistState> {
  const res = await fetch(`/api/v1/blogs/${blogId}/domain/waitlist`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Whether the blog has joined the custom-domain waitlist + interest count. */
export function useDomainWaitlistQuery(blogId: string | null) {
  return useQuery({
    queryKey: queryKeys.domainWaitlist.detail(blogId ?? ""),
    queryFn: () => fetchWaitlist(blogId as string),
    enabled: !!blogId,
  });
}

/** Join the custom-domain waitlist for the blog. */
export function useJoinDomainWaitlistMutation(blogId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinWaitlist(blogId as string),
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.domainWaitlist.detail(blogId ?? ""),
        data,
      );
    },
  });
}
