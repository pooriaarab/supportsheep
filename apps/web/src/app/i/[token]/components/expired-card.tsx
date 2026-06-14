import { EmptyState } from "@repo/ui/composites/empty-state";
import { AlertCircle } from "lucide-react";

export function ExpiredCard() {
  return (
    <div className="max-w-lg mx-auto mt-12">
      <EmptyState
        icon={AlertCircle}
        title="Invite no longer available"
        description="This invite is no longer available. Contact the host if you believe this is a mistake."
        variant="error"
      />
    </div>
  );
}
