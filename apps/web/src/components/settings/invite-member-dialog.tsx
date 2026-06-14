"use client";

import { useState } from "react";
import { FormDialog } from "@repo/ui/composites/form-dialog";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { toast } from "sonner";

import {
  useCreateInviteMutation,
  type InvitableRole,
} from "@/hooks/use-invites-query";

const ROLE_OPTIONS: { value: InvitableRole; label: string }[] = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The blog to invite into (the caller's active tenant). */
  blogId: string | null;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  blogId,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("author");
  const createInvite = useCreateInviteMutation();

  const resetForm = () => {
    setEmail("");
    setRole("author");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !blogId) return;

    try {
      const result = await createInvite.mutateAsync({
        blogId,
        email: trimmedEmail,
        role,
      });
      toast.success(
        result.added
          ? `${trimmedEmail} added to the blog`
          : `Invite sent to ${trimmedEmail}`,
      );
      handleOpenChange(false);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      toast.error(
        reason === "already_member"
          ? "That person is already a member."
          : "Failed to invite member",
      );
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Invite member"
      description="Invite someone to this blog by email. Existing accounts are added immediately; everyone else receives an email with an accept link."
      submitLabel={createInvite.isPending ? "Inviting..." : "Send invite"}
      loading={createInvite.isPending}
      disabled={!email.trim() || !blogId}
      onSubmit={handleSubmit}
      className="sm:max-w-md"
    >
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={createInvite.isPending}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as InvitableRole)}
          disabled={createInvite.isPending}
        >
          <SelectTrigger id="invite-role" className="w-full">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FormDialog>
  );
}
