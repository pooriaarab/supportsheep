"use client";

import { useCallback } from "react";
import { CheckCircle2, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/primitives/card";

import { useBlogsQuery } from "@/hooks/use-blogs-query";
import {
  useDomainWaitlistQuery,
  useJoinDomainWaitlistMutation,
} from "@/hooks/use-domain-waitlist";

/** "N blog(s) waiting" line shown once the count is known. */
function InterestCount({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {total} {total === 1 ? "blog" : "blogs"} waiting
    </p>
  );
}

export function DomainWaitlistCard() {
  const { data: blogsData } = useBlogsQuery();
  const blogId = blogsData?.activeBlogId ?? null;

  const { data, isLoading } = useDomainWaitlistQuery(blogId);
  const joinMutation = useJoinDomainWaitlistMutation(blogId);

  const joined = data?.joined ?? false;
  const totalInterested = data?.totalInterested ?? 0;

  const handleJoin = useCallback(() => {
    joinMutation.mutate(undefined, {
      onSuccess: () => toast.success("You're on the waitlist."),
      onError: (err) => toast.error(err.message),
    });
  }, [joinMutation]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              Custom domains — coming soon
            </CardTitle>
            <CardDescription>
              Use your own domain like blog.yourbrand.com. We&apos;re rolling
              this out — join the waitlist and we&apos;ll email you when it&apos;s
              ready.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading || !blogId ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : joined ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-border bg-success/10 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-sm font-medium text-foreground">
                  You&apos;re on the list
                </span>
              </div>
              <InterestCount total={totalInterested} />
            </div>
          ) : (
            <div className="space-y-3">
              <Button onClick={handleJoin} disabled={joinMutation.isPending}>
                {joinMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  "Join the waitlist"
                )}
              </Button>
              <InterestCount total={totalInterested} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
