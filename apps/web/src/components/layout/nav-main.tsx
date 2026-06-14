"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@repo/ui/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/primitives/tooltip";
import { mainNavItems, type NavItem } from "@/lib/nav-config";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";

// ---- SidebarNavItem ----

interface SidebarNavItemProps {
  item: NavItem;
  collapsed?: boolean;
  className?: string;
  iconSize?: string;
  onCreateNew?: () => void;
}

export function SidebarNavItem({
  item,
  collapsed = false,
  className,
  iconSize = "size-4",
  onCreateNew,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "relative flex items-center justify-center h-7 rounded-lg text-[13px] font-normal transition-colors",
              isActive
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              className,
            )}
          >
            <Icon className={cn(iconSize, "shrink-0")} />
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-error px-0.5 text-[9px] font-semibold text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={cn(
        "group/nav flex items-center gap-2 px-2.5 h-7 rounded-lg text-[13px] font-normal transition-colors",
        isActive
          ? "bg-foreground/[0.07] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        className,
      )}
    >
      <Link href={item.href} className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={cn(iconSize, "shrink-0")} />
        <span className="whitespace-nowrap">{item.label}</span>
      </Link>
      {item.badge != null && item.badge > 0 && (
        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[9px] font-semibold text-white shrink-0">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {item.canCreate && onCreateNew && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateNew();
          }}
          className="opacity-0 group-hover/nav:opacity-100 shrink-0 size-5 flex items-center justify-center rounded hover:bg-foreground/[0.06] transition-opacity text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ---- SidebarNavGroup ----

interface SidebarNavGroupProps {
  item: NavItem;
  collapsed?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCreateNew?: () => void;
}

function SidebarNavGroup({
  item,
  collapsed = false,
  expanded,
  onToggleExpanded,
  onCreateNew,
}: SidebarNavGroupProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "flex items-center justify-center h-7 rounded-lg text-[13px] font-normal transition-colors",
              isActive
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group/nav flex items-center gap-2 px-2.5 h-7 rounded-lg text-[13px] font-normal transition-colors",
          isActive
            ? "bg-foreground/[0.07] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        <Link href={item.href} className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{item.label}</span>
        </Link>
        <button
          onClick={onToggleExpanded}
          className="shrink-0 size-5 flex items-center justify-center rounded hover:bg-foreground/[0.06] transition-transform"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        </button>
        <span className="flex-1" />
        {item.canCreate && onCreateNew && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateNew();
            }}
            className="opacity-0 group-hover/nav:opacity-100 shrink-0 size-5 flex items-center justify-center rounded hover:bg-foreground/[0.06] transition-opacity text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      {expanded && item.children && (
        <div className="ml-4 mt-0.5 flex flex-col gap-px">
          {item.children.map((child) => (
            <SidebarNavItem
              key={child.href}
              item={child}
              iconSize="size-3.5"
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---- NavMain ----

interface NavMainProps {
  collapsed?: boolean;
  expandedItems: string[];
  onToggleExpanded: (label: string) => void;
  onCreateNew: (label: string) => void;
  taskBadge?: number;
  inboxBadge?: number;
}

export function NavMain({
  collapsed = false,
  expandedItems,
  onToggleExpanded,
  onCreateNew,
  taskBadge,
  inboxBadge,
}: NavMainProps) {
  const { user: currentUser } = useAuth();
  const { data: userProfile } = useUserQuery(currentUser?.uid ?? "");
  const role = userProfile?.role;
  const isAdminOrEditor = (role as string) === "admin" || (role as string) === "editor" || (role as string) === "owner";

  const items: NavItem[] = useMemo(
    () =>
      mainNavItems.map((item) => {
        let updatedItem = { ...item };
        if (updatedItem.label === "Tasks" && taskBadge) {
          updatedItem = { ...updatedItem, badge: taskBadge };
        }
        if (updatedItem.label === "Inbox" && inboxBadge) {
          updatedItem = { ...updatedItem, badge: inboxBadge };
        }
        // Gate "Live watch" child in Interview group
        if (updatedItem.label === "Interview" && updatedItem.children) {
          updatedItem = {
            ...updatedItem,
            children: updatedItem.children.filter((child) => {
              if (child.label === "Live watch") {
                return isAdminOrEditor;
              }
              return true;
            }),
          };
        }
        return updatedItem;
      }),
    [taskBadge, inboxBadge, isAdminOrEditor],
  );

  return (
    <nav
      className={cn(
        "py-2 px-1.5 shrink-0 border-t border-border",
        collapsed && "px-1",
      )}
    >
      <div className="flex flex-col gap-px">
        {items.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const handleCreate = item.canCreate
            ? () => onCreateNew(item.label)
            : undefined;
          return (
            <div key={item.href}>
              {hasChildren ? (
                <SidebarNavGroup
                  item={item}
                  collapsed={collapsed}
                  expanded={expandedItems.includes(item.label)}
                  onToggleExpanded={() => onToggleExpanded(item.label)}
                  onCreateNew={handleCreate}
                />
              ) : (
                <SidebarNavItem
                  item={item}
                  collapsed={collapsed}
                  onCreateNew={handleCreate}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
