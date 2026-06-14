"use client";

import React from "react";
import { PageShell } from "@/components/ui/layout/page-shell";
import { ShareLinkTable } from "./components/share-link-table";

export default function ShareLinksPage() {
  return (
    <PageShell breadcrumbs={[{ label: "Interview share links" }]}>
      <ShareLinkTable />
    </PageShell>
  );
}
