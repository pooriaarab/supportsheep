import { PageHeader } from "@/components/ui/layout/page-header";
import { DomainSettings } from "@/components/settings/domain-settings";

import { DomainWaitlistCard } from "./components/domain-waitlist-card";

export default function DomainSettingsPage() {
  // Custom domains (Cloudflare for SaaS) are only live once the zone is
  // configured. Until then, show the coming-soon + waitlist card; flip the flag
  // to reveal the real domain-management UI.
  const customDomainsEnabled = process.env.CUSTOM_DOMAINS_ENABLED === "true";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Domain" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        {customDomainsEnabled ? <DomainSettings /> : <DomainWaitlistCard />}
      </div>
    </div>
  );
}
