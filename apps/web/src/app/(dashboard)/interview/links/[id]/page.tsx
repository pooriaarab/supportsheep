"use client";

import React, { use, useState, useMemo, useCallback } from "react";
import { DetailLayout } from "@/components/ui/layout/detail-layout";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { useShareLinksQuery, useRevokeShareLink } from "@/hooks/use-share-links-query";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";
import { ShareLinkDialog } from "../components/share-link-dialog";
import {
  Calendar,
  Clock,
  Mic,
  Lock,
  Link2,
  Copy,
  Ban,
  FileText,
  Users,
  CopyIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ShareLinkDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: userProfile } = useUserQuery(currentUser?.uid ?? "");

  const canRevoke = useMemo(() => {
    if (!userProfile) return false;
    const role = userProfile.role;
    // Owner is a superset of admin — workspace owners can revoke too.
    return role === "admin" || role === "owner";
  }, [userProfile]);

  const { data: shareLinks = [], isLoading } = useShareLinksQuery();
  const link = useMemo(() => shareLinks.find((l) => l.id === id), [shareLinks, id]);
  const revokeLink = useRevokeShareLink();

  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const handleRevoke = useCallback(async () => {
    if (!link) return;
    try {
      await revokeLink.mutateAsync(link.id);
      toast.success("Share link revoked");
      setRevokeConfirmOpen(false);
    } catch {
      // Handled by hook
    }
  }, [link, revokeLink]);

  const handleCopyNotice = useCallback(() => {
    toast.error("Plaintext token was shown only at creation. If lost, you must duplicate or recreate the link.");
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Loading share link details...
      </div>
    );
  }

  if (!link) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Link2}
          title="Share link not found"
          description="The requested share link does not exist or you do not have permission to view it."
          action={{
            label: "Back to links",
            onClick: () => router.push("/interview/links"),
          }}
        />
      </div>
    );
  }

  const isRevoked = link.status === "revoked" || link.status === "expired";

  const overviewTabContent = (
    <div className="space-y-6 max-w-3xl">
      {/* Sec Notice */}
      <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 flex gap-3 items-start">
        <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-warning">Plaintext Token Security</h4>
          <p className="text-[11px] text-muted-foreground leading-normal">
            For security reasons, plaintext tokens are hashed and <strong>never stored on the server</strong>. This page cannot display or rebuild the guest URL. If lost, click &quot;Duplicate&quot; below to generate a new active invite link.
          </p>
        </div>
      </div>

      {/* Topic & Goal Card */}
      <Card className="p-6 space-y-4">
        <div>
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Topic</h4>
          <p className="text-lg font-medium text-foreground mt-1">
            {link.topic || "Untitled Interview"}
          </p>
        </div>
        {link.goal && (
          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Goal</h4>
            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
              {link.goal}
            </p>
          </div>
        )}
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Interview Configuration</h4>
          <div className="grid gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Who can join:</span>
              <span className="text-foreground capitalize font-medium">{link.type}</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Style:</span>
              <span className="text-foreground capitalize font-medium">{link.style}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mic className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Capture config:</span>
              <span className="text-foreground capitalize font-medium">{link.recordingConfig}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Max duration:</span>
              <span className="text-foreground font-medium">{Math.round(link.maxDurationSec / 60)} min</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Validity & Access</h4>
          <div className="grid gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Expires:</span>
              <span className="text-foreground font-medium">{formatDate(link.expiresAt)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Uses:</span>
              <span className="text-foreground font-medium">
                {link.uses} / {link.maxUses !== null ? link.maxUses : "∞"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[100px]">Gate/Auth mode:</span>
              <span className="text-foreground capitalize font-medium">{link.authMode.replace(/_/g, " ")}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const sessionsTabContent = (
    <div className="space-y-6">
      <EmptyState
        icon={Users}
        title="No interview sessions yet"
        description="Once guests start responding to this invite link, their interviews will appear here."
      />
    </div>
  );

  return (
    <div className="h-full">
      <DetailLayout
        backHref="/interview/links"
        backLabel="Share links"
        title={link.topic || "Untitled Share Link"}
        subtitle={`Created by member • Status: ${link.status}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopyNotice} disabled={isRevoked} className="flex gap-1.5 items-center">
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDuplicateOpen(true)} className="flex gap-1.5 items-center">
              <CopyIcon className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            {canRevoke && !isRevoked && (
              <Button size="sm" variant="destructive" onClick={() => setRevokeConfirmOpen(true)} className="flex gap-1.5 items-center">
                <Ban className="h-3.5 w-3.5" />
                Revoke
              </Button>
            )}
          </div>
        }
        tabs={[
          { value: "overview", label: "Overview", content: overviewTabContent },
          { value: "interviews", label: "Sessions", content: sessionsTabContent },
        ]}
      />

      {/* Duplicate Flow (Prefilled form dialog) */}
      <ShareLinkDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        initialTopic={link.topic || ""}
      />

      {/* Revoke Soft Confirm Dialog */}
      <ConfirmDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        title="Revoke Share Link"
        description="Are you sure you want to revoke this share link? Once revoked, guests will no longer be able to use it to join or start AI interviews. This action is permanent."
        confirmLabel="Revoke link"
        variant="destructive"
        onConfirm={handleRevoke}
        loading={revokeLink.isPending}
      />
    </div>
  );
}
