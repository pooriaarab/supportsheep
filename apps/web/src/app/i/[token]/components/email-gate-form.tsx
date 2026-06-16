"use client";

import React, { useState } from "react";
import { z } from "zod";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";

interface Props {
  token: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
});

export function EmailGateForm({ token }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Client-side validation
    const result = formSchema.safeParse({ name, email });
    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (typeof path === "string") {
          formattedErrors[path] = issue.message;
        }
      });
      setErrors(formattedErrors);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareLinkToken: token,
          guestName: name,
          guestEmail: email,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start interview");
      }

      const { interviewId } = (await res.json()) as { interviewId: string };
      window.location.href = `/i/${token}/consent?interview=${interviewId}`;
    } catch (err: unknown) {
      const errorWithMessage = err as { message?: string };
      setErrors({ form: errorWithMessage.message || "An unexpected error occurred. Please try again." });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {errors.form && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
          {errors.form}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Your Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-destructive text-xs font-medium">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Your Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-destructive text-xs font-medium">{errors.email}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
        {loading ? "Starting..." : "Continue to interview"}
      </Button>
    </form>
  );
}
