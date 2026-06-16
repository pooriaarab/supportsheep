import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

/** Roles a blog admin can invite someone in as (mirrors the invite API). */
export type InvitableRole = "author" | "editor" | "viewer";

export interface CreateInviteInput {
  blogId: string;
  email: string;
  role: InvitableRole;
}

export interface CreateInviteResult {
  /** True when the email matched an existing account and they were added directly. */
  added?: boolean;
  /** True when no account existed yet and a pending invite was emailed. */
  invited?: boolean;
}

async function createInvite({
  blogId,
  email,
  role,
}: CreateInviteInput): Promise<CreateInviteResult> {
  const res = await fetch(
    `/api/v1/blogs/${encodeURIComponent(blogId)}/invites`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(json?.error ?? "Failed to invite member");
  }
  return (await res.json()) as CreateInviteResult;
}

export function useCreateInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      // An added existing user shows up in the members list immediately.
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
