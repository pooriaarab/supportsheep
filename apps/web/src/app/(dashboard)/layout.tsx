/**
 * Dashboard Layout
 *
 * This layout wraps all authenticated dashboard pages with the sidebar navigation.
 * The sidebar is collapsible on desktop and uses a hamburger menu on mobile.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  SidebarProvider,
  DashboardLayoutClient,
} from "@/components/layout/dashboard-layout-client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { NewThreadDialogWrapper } from "@/components/layout/new-thread-dialog-wrapper";
import { NotificationProvider } from "@/contexts/notification-context";
import { AiChatWidget } from "@/components/shared/ai-chat-widget";
import { verifyRequest } from "@/lib/auth/session";
import { getMembershipByUser } from "@/lib/tenancy/repository";

export const metadata: Metadata = {
  title: {
    template: "%s | My App",
    default: "Dashboard | My App",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth (session cookie) is enforced by middleware.ts, which redirects
  // unauthenticated users to /login. Here we additionally route authenticated
  // users who have no blog membership to onboarding so they create a blog
  // before reaching the dashboard. If session verification fails for any
  // reason, defer to middleware rather than redirecting from the layout.
  try {
    const session = await verifyRequest();
    const membership = await getMembershipByUser(session.uid);
    if (!membership) {
      redirect("/onboarding");
    }
  } catch (error) {
    // redirect() throws a NEXT_REDIRECT control-flow signal — re-throw it so
    // Next.js performs the redirect. Any other error (e.g. no session) is left
    // to middleware's auth handling.
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
  }

  return (
    <NotificationProvider>
      <SidebarProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          <AppSidebar />
          <DashboardLayoutClient>{children}</DashboardLayoutClient>
        </div>
        <CommandPalette />
        <NewThreadDialogWrapper />
        <AiChatWidget />
      </SidebarProvider>
    </NotificationProvider>
  );
}
