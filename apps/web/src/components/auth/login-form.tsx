"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Mail } from "lucide-react";
import { authClient } from "@/lib/auth/better-auth-client";
import { magicLinkErrorMessage } from "./login-error";
import { safeReturnTo } from "./safe-return-to";

function LoginFormFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">Loading</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Guard against open-redirect: only same-origin paths (rejects //host, /\host, https://…).
  const returnTo = safeReturnTo(getSearchParam("returnTo"));

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    try {
      setMagicLinkLoading(true);
      setError("");
      const { error: signInError } = await authClient.signIn.magicLink({
        email,
        callbackURL: returnTo,
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
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-2">
              <div className="size-10 rounded-xl bg-foreground flex items-center justify-center">
                <Mail className="size-5 text-background" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Check your email
            </CardTitle>
            <CardDescription className="text-center">
              We sent a sign-in link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Click the link in the email to sign in. You can close this tab.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="size-10 rounded-xl bg-foreground flex items-center justify-center">
              <span className="text-background text-lg font-bold leading-none">
                A
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleMagicLink}
              disabled={magicLinkLoading}
            >
              <Mail className="size-4 mr-2" />
              {magicLinkLoading ? "Sending..." : "Send magic link"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
