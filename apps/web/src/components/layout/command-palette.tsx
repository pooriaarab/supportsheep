/**
 * Command Palette Component (Cmd+K)
 * Quick actions, page navigation, and search
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/primitives/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  X,
  Search,
  Loader2,
  Plus,
  PanelLeft,
  ArrowRight,
  Settings,
  Home,
  FileText,
} from "lucide-react";
import {
  useCommandPalette,
  useSidebar,
} from "@/components/layout/dashboard-layout-client";
import {
  mainNavItems,
  settingsNavItems,
  flattenNavItems,
} from "@/lib/nav-config";
import { useLatestRef } from "@/hooks/use-latest-ref";
import type { NavItem } from "@/lib/nav-config";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const { push } = useRouter();
  const { collapsed, toggleCollapsed, mounted } = useSidebar();

  const debouncedQuery = useDebouncedValue(query, 300);
  const isTyping = query.length >= 2 && query !== debouncedQuery;

  // Quick actions
  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: "new-post",
        label: "New Post",
        icon: Plus,
        keywords: ["new", "post", "article", "create"],
        action: () => push("/posts?new=true"),
        shortcut: "C",
      },
      {
        id: "toggle-sidebar",
        label: collapsed ? "Expand Sidebar" : "Collapse Sidebar",
        icon: PanelLeft,
        keywords: ["sidebar", "collapse", "expand", "toggle", "panel"],
        action: toggleCollapsed,
      },
      {
        id: "view-dashboard",
        label: "View Dashboard",
        icon: Home,
        keywords: ["dashboard", "home", "overview"],
        action: () => push("/dashboard"),
      },
      {
        id: "view-posts",
        label: "View Posts",
        icon: FileText,
        keywords: ["posts", "articles", "blog"],
        action: () => push("/posts"),
      },
      {
        id: "view-settings",
        label: "View Settings",
        icon: Settings,
        keywords: ["settings", "config", "preferences"],
        action: () => push("/settings/general"),
      },
    ],
    [collapsed, push, toggleCollapsed],
  );

  // Navigation items -- combined main + settings
  const navItems: NavItem[] = useMemo(() => {
    return [...flattenNavItems(mainNavItems), ...settingsNavItems];
  }, []);

  // Client-side filtering for actions and nav
  const filteredActions = useMemo(() => {
    if (!query) return quickActions;
    const q = query.toLowerCase();
    return quickActions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.includes(q)),
    );
  }, [query, quickActions]);

  const filteredNav = useMemo(() => {
    if (!query) return navItems;
    const q = query.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [query, navItems]);

  // Keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => {
          setQuery("");
          return !prev;
        });
      }
    },
    [setOpen],
  );
  const handleKeyDownRef = useLatestRef(handleKeyDown);

  useMountEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      handleKeyDownRef.current(event);
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () =>
      document.removeEventListener("keydown", handleDocumentKeyDown);
  });

  const handleActionSelect = useCallback(
    (action: QuickAction) => {
      setOpen(false);
      setQuery("");
      action.action();
    },
    [setOpen],
  );

  const handleNavSelect = useCallback(
    (item: NavItem) => {
      setOpen(false);
      setQuery("");
      push(item.href);
    },
    [push, setOpen],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setQuery("");
      setOpen(nextOpen);
    },
    [setOpen],
  );

  // Skip rendering during SSR/hydration to avoid Radix useId() hydration mismatch
  if (!mounted) return null;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      showCloseButton={false}
    >
      <div className="flex h-12 items-center gap-2 border-b px-3">
        {isTyping ? (
          <Loader2 className="size-4 shrink-0 animate-spin opacity-50" />
        ) : (
          <Search className="size-4 shrink-0 opacity-50" />
        )}
        <CommandPrimitive.Input
          placeholder="Search or jump to..."
          value={query}
          onValueChange={setQuery}
          className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        {query && !isTyping && (
          <button
            onClick={() => setQuery("")}
            className="shrink-0 rounded-sm opacity-50 hover:opacity-100 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>

      <CommandList>
        {/* Quick Actions */}
        {filteredActions.length > 0 && (
          <CommandGroup heading="Actions">
            {filteredActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleActionSelect(action)}
                  className="flex items-center gap-2"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border rounded text-muted-foreground">
                      {action.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <>
            {filteredActions.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Go to">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => handleNavSelect(item)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight className="size-3 text-muted-foreground/50" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Empty state */}
        {filteredActions.length === 0 && filteredNav.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search className="size-8 text-muted-foreground/70 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              No matching actions or pages
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Try a different search term
            </p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
