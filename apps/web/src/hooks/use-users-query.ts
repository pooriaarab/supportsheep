import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  // Full role hierarchy: `owner > admin > editor > viewer > guest`
  // (see `lib/api-utils.roleSatisfies`). "member" stays in the union for
  // backwards-compatibility with any user docs still on the pre-v1
  // role set.
  role: "owner" | "admin" | "editor" | "member" | "viewer" | "guest";
  status: "active" | "paused" | "deleted";
  avatarUrl?: string;
  joinedAt: string;
}

async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch("/api/v1/users");
  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }
  const json = (await res.json()) as { data: AppUser[] };
  return json.data;
}

async function fetchUser(id: string): Promise<AppUser | undefined> {
  const res = await fetch(`/api/v1/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error("Failed to fetch user");
  }
  return (await res.json()) as AppUser;
}

async function deleteUsers(ids: string[]): Promise<void> {
  const res = await fetch("/api/v1/users", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    throw new Error("Failed to delete users");
  }
}

async function updateUserRole(
  id: string,
  role: AppUser["role"],
): Promise<void> {
  const res = await fetch(`/api/v1/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error("Failed to update user role");
  }
}

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users.lists(),
    queryFn: fetchUsers,
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
  });
}

export function useDeleteUsersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUsers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppUser["role"] }) =>
      updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
