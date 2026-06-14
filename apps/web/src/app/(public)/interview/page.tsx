import { Button } from "@repo/ui/primitives/button";
import { Card } from "@repo/ui/primitives/card";
import Link from "next/link";

export default function InterviewInviteOnlyPage() {
  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <Card className="p-8 text-center space-y-6">
        <h1 className="text-2xl font-bold">AI Interviews</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Interviews are invite-only. Sign in to start one, or use a share link from your host.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </Card>
    </div>
  );
}
