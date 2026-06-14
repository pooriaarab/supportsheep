"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";

/** Where a user lands after their blog is created (matches login's redirect). */
const POST_ONBOARDING_ROUTE = "/dashboard";

/** Debounce window for the live slug-availability check. */
const SLUG_CHECK_DEBOUNCE_MS = 400;

type SlugStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "invalid" }
  | { kind: "reserved" }
  | { kind: "taken" };

/** Mirror the API's normalization: slugs are lowercased, no whitespace. */
function normalizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "-");
}

const SLUG_STATUS_MESSAGE: Record<
  Exclude<SlugStatus["kind"], "idle" | "checking">,
  { text: string; tone: "success" | "error" }
> = {
  available: { text: "Available", tone: "success" },
  invalid: {
    text: "Use 3–32 lowercase letters, numbers, or hyphens.",
    tone: "error",
  },
  reserved: { text: "That name is reserved. Try another.", tone: "error" },
  taken: { text: "That name is already taken.", tone: "error" },
};

export function OnboardingForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier availability response overwriting a newer one.
  const latestSlugRef = useRef("");

  const checkAvailability = async (candidate: string) => {
    try {
      const res = await fetch(
        `/api/v1/blogs/slug-available?slug=${encodeURIComponent(candidate)}`,
      );
      if (latestSlugRef.current !== candidate) return;
      if (!res.ok) {
        setSlugStatus({ kind: "idle" });
        return;
      }
      const data = (await res.json()) as {
        available: boolean;
        reason?: "invalid_format" | "reserved" | "taken";
      };
      if (latestSlugRef.current !== candidate) return;
      if (data.available) {
        setSlugStatus({ kind: "available" });
      } else if (data.reason === "reserved") {
        setSlugStatus({ kind: "reserved" });
      } else if (data.reason === "taken") {
        setSlugStatus({ kind: "taken" });
      } else {
        setSlugStatus({ kind: "invalid" });
      }
    } catch {
      if (latestSlugRef.current === candidate) {
        setSlugStatus({ kind: "idle" });
      }
    }
  };

  const handleSlugChange = (raw: string) => {
    const next = normalizeSlug(raw);
    setSlug(next);
    latestSlugRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.length < 3) {
      setSlugStatus(next.length === 0 ? { kind: "idle" } : { kind: "invalid" });
      return;
    }

    setSlugStatus({ kind: "checking" });
    debounceRef.current = setTimeout(() => {
      void checkAvailability(next);
    }, SLUG_CHECK_DEBOUNCE_MS);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!displayName.trim()) {
      setFormError("Please enter a name for your blog.");
      return;
    }
    if (slug.length < 3) {
      setSlugStatus({ kind: "invalid" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, displayName: displayName.trim() }),
      });

      if (res.status === 201) {
        router.push(POST_ONBOARDING_ROUTE);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (data.error === "slug_taken") {
        setSlugStatus({ kind: "taken" });
      } else if (data.error === "slug_reserved") {
        setSlugStatus({ kind: "reserved" });
      } else if (data.error === "invalid_slug") {
        setSlugStatus({ kind: "invalid" });
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusMessage =
    slugStatus.kind === "idle" || slugStatus.kind === "checking"
      ? null
      : SLUG_STATUS_MESSAGE[slugStatus.kind];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Create your blog
          </CardTitle>
          <CardDescription className="text-center">
            Pick a name and a URL to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="displayName">Blog name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Blog"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-blog"
                maxLength={32}
                aria-invalid={statusMessage?.tone === "error"}
                aria-describedby="slug-status"
              />
              <p
                id="slug-status"
                className={
                  slugStatus.kind === "checking"
                    ? "text-sm text-muted-foreground"
                    : statusMessage?.tone === "success"
                      ? "text-sm text-success"
                      : statusMessage?.tone === "error"
                        ? "text-sm text-error"
                        : "text-sm text-muted-foreground"
                }
              >
                {slugStatus.kind === "checking"
                  ? "Checking availability…"
                  : (statusMessage?.text ?? "Lowercase letters, numbers, and hyphens.")}
              </p>
            </div>

            {formError ? (
              <p className="text-sm text-error" role="alert">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || slugStatus.kind === "checking"}
            >
              {submitting ? "Creating…" : "Create blog"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
