"use client";

import React from "react";
import { PageShell } from "@/components/ui/layout/page-shell";
import { SessionsTable } from "./components/sessions-table";

export default function InterviewSessionsPage() {
  return (
    <PageShell breadcrumbs={[{ label: "Interview sessions" }]}>
      <SessionsTable />
    </PageShell>
  );
}
