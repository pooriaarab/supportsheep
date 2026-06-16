"use client";

import React, { useState } from "react";
import { z } from "zod";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";
import { MailCheck } from "lucide-react";

interface Props {
  token: string;
}

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export function MagicLinkForm({ token }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Client-side validation
    const result = formSchema.safeParse({ email });
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setErrors({ email: firstIssue?.message || "Invalid email" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/interviews/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareLinkToken: token,
          email,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send magic link");
      }

      setSent(true);
    } catch (err: unknown) {
      const errorWithMessage = err as { message?: string };
      setErrors({ form: errorWithMessage.message || "An unexpected error occurred. Please try again." });
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            We sent a secure login link to <span className="font-semibold text-foreground">{email}</span>. 
            Click the link in your email to join the interview.
          </p>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          You can close this tab now.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {errors.form && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
          {errors.form}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Your Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-destructive text-xs font-medium">{errors.email}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
        {loading ? "Sending..." : "Send magic link"}
      </Button>
    </form>
  );
}
