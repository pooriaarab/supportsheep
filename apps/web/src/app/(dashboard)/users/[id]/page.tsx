"use client";

import { use } from "react";
import { DetailLayout } from "@/components/ui/layout/detail-layout";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { Button } from "@repo/ui/primitives/button";
import { Label } from "@repo/ui/primitives/label";
import { Input } from "@repo/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Switch } from "@repo/ui/primitives/switch";
import { useUserQuery } from "@/hooks/use-users-query";
import { Mail, Calendar, Shield } from "lucide-react";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function OverviewTab({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUserQuery(userId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-xl font-semibold text-muted-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {user.name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{user.role}</Badge>
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Details</h4>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="text-foreground">{user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="text-foreground capitalize">{user.role}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Joined:</span>
            <span className="text-foreground">
              {formatDate(user.joinedAt)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ActivityTab() {
  const activities = [
    { id: "1", action: "Logged in", time: "2 hours ago" },
    { id: "2", action: "Updated profile settings", time: "1 day ago" },
    { id: "3", action: "Created item #1847", time: "2 days ago" },
    { id: "4", action: "Invited a team member", time: "3 days ago" },
    { id: "5", action: "Changed password", time: "1 week ago" },
    { id: "6", action: "Connected Slack integration", time: "2 weeks ago" },
  ];

  return (
    <div className="max-w-2xl">
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Recent Activity
        </h4>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-0">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 py-3 relative"
              >
                <div className="size-4 rounded-full border-2 border-border bg-background z-10 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function SettingsTab({ userId }: { userId: string }) {
  const { data: user } = useUserQuery(userId);

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            User Settings
          </h4>
          <p className="text-xs text-muted-foreground">
            Manage this user&apos;s account settings.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground/80">
                Display Name
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                The name shown across the application
              </p>
            </div>
            <Input
              defaultValue={user?.name ?? ""}
              className="w-64"
              disabled
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground/80">
                Role
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Determines access level and permissions
              </p>
            </div>
            <Select defaultValue={user?.role ?? "member"}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground/80">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive email updates about account activity
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </Card>

      <Card className="p-6 border-error/20">
        <h4 className="text-sm font-semibold text-error mb-1">Danger Zone</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently remove this user and all of their data.
        </p>
        <Button variant="outline" size="sm" className="text-error border-error/30 hover:bg-error-subtle">
          Delete User
        </Button>
      </Card>
    </div>
  );
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: user, isLoading } = useUserQuery(id);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <DetailLayout
      backHref="/users"
      backLabel="Users"
      title={user?.name ?? "User"}
      subtitle={user?.email}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: <OverviewTab userId={id} />,
        },
        {
          value: "activity",
          label: "Activity",
          content: <ActivityTab />,
        },
        {
          value: "settings",
          label: "Settings",
          content: <SettingsTab userId={id} />,
        },
      ]}
      defaultTab="overview"
    />
  );
}
