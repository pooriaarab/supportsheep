"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/primitives/card";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth/better-auth-client";
import { useAuth } from "@/contexts/auth-context";
import { magicLinkErrorMessage } from "./login-error";

interface InvitePreview {
  email: string;
  role: string;
  blogName: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: number;
}

async function fetchInvite(token: string): Promise<InvitePreview | null> {
  const res = await fetch(`/api/v1/invites/${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load invite");
  return (await res.json()) as InvitePreview;
}

async function acceptInvite(token: string): Promise<{ blogId: string }> {
  const res = await fetch("/api/v1/invites/accept", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "accept_failed");
  }
  return (await res.json()) as { blogId: string };
}

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {title}
          </CardTitle>
          <CardDescription className="text-center">
            {description}
          </CardDescription>
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </div>
  );
}

export function AcceptInvite() {
  return (
    <Suspense
      fallback={<Shell title="Accept invite" description="Loading" />}
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, loading: authLoading } = useAuth();

  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const callbackURL = useMemo(
    () => `/accept-invite?token=${encodeURIComponent(token)}`,
    [token],
  );

  const {
    data: invite,
    isLoading: inviteLoading,
    isError: inviteError,
  } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite(token),
    enabled: token.length > 0,
  });

  const handleMagicLink = useCallback(async () => {
    if (!invite) return;
    try {
      setMagicLinkLoading(true);
      setError("");
      const { error: signInError } = await authClient.signIn.magicLink({
        email: invite.email,
        callbackURL,
      });
      if (signInError) {
        setError(magicLinkErrorMessage(signInError));
        return;
      }
      setMagicLinkSent(true);
    } catch {
      setError(magicLinkErrorMessage(undefined));
    } finally {
      setMagicLinkLoading(false);
    }
  }, [invite, callbackURL]);

  const handleAccept = useCallback(async () => {
    try {
      setAccepting(true);
      setError("");
      await acceptInvite(token);
      // Full navigation so the new membership + cookies are picked up fresh.
      window.location.href = "/dashboard";
    } catch (err) {
      const reason = err instanceof Error ? err.message : "accept_failed";
      if (reason === "email_mismatch") {
        setError(
          "This invite was sent to a different email. Sign in with the invited address.",
        );
      } else if (reason === "expired") {
        setError("This invite has expired. Ask the support portal owner to send a new one.");
      } else if (reason === "already_accepted") {
        setError("This invite has already been used.");
      } else {
        setError("Could not accept the invite. Please try again.");
      }
      setAccepting(false);
    }
  }, [token]);

  if (!token) {
    return (
      <Shell
        title="Invalid invite"
        description="This link is missing its invite token."
      />
    );
  }

  if (inviteLoading || authLoading) {
    return <Shell title="Accept invite" description="Loading your invite" />;
  }

  if (inviteError || !invite) {
    return (
      <Shell
        title="Invite not found"
        description="This invite link is invalid or has been revoked."
      />
    );
  }

  if (invite.status === "expired") {
    return (
      <Shell
        title="Invite expired"
        description={`Your invite to ${invite.blogName} has expired. Ask the support portal owner to send a new one.`}
      />
    );
  }

  if (invite.status === "accepted") {
    return (
      <Shell
        title="Invite already used"
        description={`This invite to ${invite.blogName} has already been accepted.`}
      />
    );
  }

  // Signed out → send a magic link to the invited address.
  if (!user) {
    if (magicLinkSent) {
      return (
        <Shell
          title="Check your email"
          description={`We sent a sign-in link to ${invite.email}. Open it to continue accepting your invite.`}
        />
      );
    }
    return (
      <Shell
        title={`Join ${invite.blogName}`}
        description={`You've been invited as a ${invite.role}. Sign in to accept.`}
      >
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={invite.email} disabled />
          </div>
          <Button
            className="w-full"
            onClick={handleMagicLink}
            disabled={magicLinkLoading}
          >
            <Mail className="size-4 mr-2" />
            {magicLinkLoading ? "Sending..." : "Send sign-in link"}
          </Button>
        </div>
      </Shell>
    );
  }

  // Signed in but with the wrong account.
  const sessionEmail = (user.email ?? "").toLowerCase();
  if (sessionEmail !== invite.email) {
    return (
      <Shell
        title="Wrong account"
        description={`This invite was sent to ${invite.email}, but you're signed in as ${user.email}. Sign in with the invited address to accept.`}
      >
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = callbackURL;
          }}
        >
          Sign in with a different account
        </Button>
      </Shell>
    );
  }

  // Signed in as the invited recipient → accept.
  return (
    <Shell
      title={`Join ${invite.blogName}`}
      description={`Accept your invitation to join as a ${invite.role}.`}
    >
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      <Button className="w-full" onClick={handleAccept} disabled={accepting}>
        {accepting ? "Accepting..." : `Accept invite`}
      </Button>
    </Shell>
  );
}
