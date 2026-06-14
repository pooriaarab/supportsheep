import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "info"
  | "warning"
  | "error"
  | "success"
  | "task"
  | "mention"
  | "system";

export interface NotificationActor {
  id: string;
  name: string;
  avatar?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  actor?: NotificationActor;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch("/api/v1/notifications");
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const json = await res.json();
  return json.data;
}

async function markAsRead(id: string): Promise<void> {
  const res = await fetch("/api/v1/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id], read: true }),
  });
  if (!res.ok) throw new Error("Failed to mark notification as read");
}

async function markAllAsRead(ids: string[]): Promise<void> {
  const res = await fetch("/api/v1/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, read: true }),
  });
  if (!res.ok) throw new Error("Failed to mark notifications as read");
}

async function deleteNotification(id: string): Promise<void> {
  const res = await fetch("/api/v1/notifications", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });
  if (!res.ok) throw new Error("Failed to delete notification");
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.notifications.lists(),
    queryFn: fetchNotifications,
  });
}

export function useMarkAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });
}

export function useMarkAllAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });
}

export function useUnreadCount(): number {
  const { data } = useNotificationsQuery();
  if (!data) return 0;
  return data.filter((n) => !n.read).length;
}
