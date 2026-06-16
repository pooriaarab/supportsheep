"use client";

import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/utils";
import { Button } from "@repo/ui/primitives/button";
import { Sheet, SheetContent, SheetTrigger } from "@repo/ui/primitives/sheet";
import {
  useSidebar,
  useCommandPalette,
  useNewThread,
} from "./dashboard-layout-client";
import { useState, useCallback } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useRouter } from "next/navigation";
import { settingsCategories } from "@/lib/nav-config";
import { NavMain } from "./nav-main";
import { NavSettings } from "./nav-settings";
import { SidebarHeader } from "./sidebar-header";
import { SidebarNavItem } from "./nav-main";
import { SidebarHelpButton } from "./sidebar-header";
import { SidebarRecentPosts } from "./sidebar-recent-posts";
import { Menu } from "lucide-react";
import { useUnreadCount } from "@/hooks/use-notifications-query";
import {
  readExpandedSidebarGroups,
  writeExpandedSidebarGroups,
} from "./app-sidebar-storage";

// Hoisted outside component -- settingsCategories is a module-level constant
const settingsPaths = settingsCategories.flatMap((c) =>
  c.items.map((i) => i.href),
);

export function AppSidebar() {
  const { collapsed, toggleCollapsed, mounted } = useSidebar();
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const { setOpen: setNewThreadOpen } = useNewThread();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  useMountEffect(() => {
    setExpandedItems(readExpandedSidebarGroups(localStorage));
  });
  const { push } = useRouter();
  const pathname = usePathname();
  const isSettingsPage =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    settingsPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const toggleExpanded = useCallback((label: string) => {
    setExpandedItems((prev) => {
      const next = prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label];
      writeExpandedSidebarGroups(localStorage, next);
      return next;
    });
  }, []);

  const inboxBadge = useUnreadCount();
  const openSearch = () => setCommandPaletteOpen(true);
  const openCreate = () => setNewThreadOpen(true);

  const handleCreateNew = useCallback(
    (label: string) => {
      switch (label) {
        case "Articles":
          push("/posts?new=true");
          break;
      }
    },
    [push],
  );

  // During SSR/hydration, render a static placeholder without Radix components
  // to avoid hydration mismatch from Radix useId() generating different IDs
  if (!mounted) {
    return (
      <>
        <aside
          className={cn(
            "hidden sm:flex flex-col border-r border-border bg-background fixed left-0 top-0 bottom-0 z-50 transition-[width] duration-200 ease-out overflow-hidden",
            "w-64",
          )}
        >
          <div className="h-11 flex items-center justify-between px-3 shrink-0">
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              My App
            </span>
          </div>
        </aside>
        <div className="sm:hidden fixed top-0 left-0 right-0 z-50 h-10 bg-background border-b border-border flex items-center px-4">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            My App
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden sm:flex flex-col border-r border-border bg-background fixed left-0 top-0 bottom-0 z-50 transition-[width] duration-200 ease-out overflow-hidden",
          collapsed ? "w-14" : "w-64",
        )}
      >
        {isSettingsPage ? (
          <>
            <div
              className={cn(
                "h-11 flex items-center shrink-0",
                collapsed ? "justify-center px-0" : "px-1.5",
              )}
            >
              <SidebarNavItem
                item={{
                  label: "Back",
                  href: "/dashboard",
                  icon: ArrowLeft,
                }}
                collapsed={collapsed}
              />
            </div>
            <NavSettings collapsed={collapsed} />
          </>
        ) : (
          <>
            <SidebarHeader
              collapsed={collapsed}
              onSearchOpen={openSearch}
              onCreateOpen={openCreate}
              onToggleCollapsed={toggleCollapsed}
            />
            <SidebarRecentPosts collapsed={collapsed} />
            <div className="flex-1" />
            <NavMain
              collapsed={collapsed}
              expandedItems={expandedItems}
              onToggleExpanded={toggleExpanded}
              onCreateNew={handleCreateNew}
              inboxBadge={inboxBadge}
            />
            <SidebarHelpButton collapsed={collapsed} />
          </>
        )}
      </aside>

      {/* Mobile Hamburger Menu */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-50 h-10 bg-background border-b border-border flex items-center px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="mr-2">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            {isSettingsPage ? (
              <>
                <div className="h-11 flex items-center shrink-0 px-1.5">
                  <SidebarNavItem
                    item={{
                      label: "Back",
                      href: "/dashboard",
                      icon: ArrowLeft,
                    }}
                  />
                </div>
                <NavSettings />
              </>
            ) : (
              <>
                <SidebarHeader
                  onSearchOpen={openSearch}
                  onCreateOpen={openCreate}
                />
                <div className="flex-1" />
                <NavMain
                  expandedItems={expandedItems}
                  onToggleExpanded={toggleExpanded}
                  onCreateNew={handleCreateNew}
                  inboxBadge={inboxBadge}
                />
                <SidebarHelpButton />
              </>
            )}
          </SheetContent>
        </Sheet>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          My App
        </span>
      </div>
    </>
  );
}
