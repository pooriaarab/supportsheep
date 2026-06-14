"use client";

import { useCallback } from "react";
import {
  Search,
  PanelLeft,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
  FileText,
  SquarePen,
} from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/primitives/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import {
  SidebarDropdownMenuContent,
  SidebarDropdownMenuItem,
  SidebarDropdownMenuSeparator,
} from "@repo/ui/composites/sidebar-menu";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { BlogSwitcher } from "./blog-switcher";

interface SidebarHeaderProps {
  collapsed?: boolean;
  onSearchOpen: () => void;
  onCreateOpen?: () => void;
  onToggleCollapsed?: () => void;
}

export function SidebarHeader({
  collapsed = false,
  onSearchOpen,
  onCreateOpen,
  onToggleCollapsed,
}: SidebarHeaderProps) {
  const { logout } = useAuth();
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  if (collapsed) {
    return (
      <div className="h-11 flex items-center justify-center shrink-0">
        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapsed}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
              >
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="h-11 flex items-center justify-between px-3 shrink-0">
      <BlogSwitcher
        footer={
          <>
            <SidebarDropdownMenuItem asChild>
              <Link href="/settings/general" className="cursor-pointer">
                <Settings className="size-3.5" />
                Settings
              </Link>
            </SidebarDropdownMenuItem>
            <SidebarDropdownMenuSeparator />
            <SidebarDropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer"
            >
              <LogOut className="size-3.5" />
              Log out
            </SidebarDropdownMenuItem>
          </>
        }
      />

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSearchOpen}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Search (Cmd+K)</TooltipContent>
        </Tooltip>
        {onCreateOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCreateOpen}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
              >
                <SquarePen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New thread</TooltipContent>
          </Tooltip>
        )}
        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapsed}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
              >
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ---- SidebarHelpButton ----

interface SidebarHelpButtonProps {
  collapsed?: boolean;
}

export function SidebarHelpButton({
  collapsed = false,
}: SidebarHelpButtonProps) {
  if (collapsed) return null;

  return (
    <div className="px-3 py-2 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="size-6 flex items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.10] hover:text-foreground transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <SidebarDropdownMenuContent align="start" side="top">
          <SidebarDropdownMenuItem asChild>
            <Link href="/settings/general" className="cursor-pointer">
              <Settings className="size-3.5" />
              Settings
            </Link>
          </SidebarDropdownMenuItem>
          <SidebarDropdownMenuSeparator />
          <SidebarDropdownMenuItem asChild>
            <Link href="/contact" className="cursor-pointer">
              <MessageSquare className="size-3.5" />
              Contact us
            </Link>
          </SidebarDropdownMenuItem>
          <SidebarDropdownMenuItem asChild>
            <Link href="/docs" className="cursor-pointer">
              <FileText className="size-3.5" />
              Documentation
            </Link>
          </SidebarDropdownMenuItem>
        </SidebarDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
