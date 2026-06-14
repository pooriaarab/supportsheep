"use client";

import { createContext, use, useState, useCallback, useMemo } from "react";
import {
  useNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  type Notification,
} from "@/hooks/use-notifications-query";

interface NotificationContextType {
  /** All notifications (remote + local) */
  notifications: Notification[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Mark a single notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Push a local notification (for real-time/in-app events) */
  notify: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  /** Whether remote notifications are loading */
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: remoteNotifications = [], isLoading } =
    useNotificationsQuery();
  const markReadMutation = useMarkAsReadMutation();
  const markAllReadMutation = useMarkAllAsReadMutation();
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(
    [],
  );

  const notifications = useMemo(
    () => [...localNotifications, ...remoteNotifications],
    [localNotifications, remoteNotifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback(
    (id: string) => {
      // Optimistically mark local notifications as read
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const unreadIds = remoteNotifications.flatMap((notification) =>
      notification.read ? [] : [notification.id],
    );
    if (unreadIds.length > 0) {
      markAllReadMutation.mutate(unreadIds);
    }
  }, [markAllReadMutation, remoteNotifications]);

  const notify = useCallback(
    (input: Omit<Notification, "id" | "createdAt" | "read">) => {
      const notification: Notification = {
        ...input,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setLocalNotifications((prev) => [notification, ...prev]);
    },
    [],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      notify,
      isLoading,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead, notify, isLoading],
  );

  return (
    <NotificationContext value={value}>{children}</NotificationContext>
  );
}

export function useNotifications() {
  const context = use(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}
