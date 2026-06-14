'use client';

import * as React from 'react';
import { cn } from '../utils';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../primitives/dropdown-menu';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../primitives/context-menu';

/**
 * Sidebar-consistent menu styles.
 *
 * Use these composites for any dropdown or context menu rendered inside
 * the sidebar. They enforce the sidebar's visual language:
 *
 * - Font size: text-[13px] (matching sidebar nav items)
 * - Icon size: consumers should use size-3.5 (14px) for menu icons
 * - Hover/focus: bg-foreground/[0.04] (matching sidebar hover)
 * - Width: w-48 by default
 */

// ── Sidebar Dropdown composites ─────────────────────────────────

const SIDEBAR_MENU_CONTENT_CLASSES = 'w-48 text-[13px]';

const SIDEBAR_MENU_ITEM_CLASSES =
  'gap-2 text-[13px] text-muted-foreground focus:bg-foreground/[0.04] focus:text-foreground';

const SidebarDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuContent
    ref={ref}
    className={cn(SIDEBAR_MENU_CONTENT_CLASSES, className)}
    {...props}
  />
));
SidebarDropdownMenuContent.displayName = 'SidebarDropdownMenuContent';

const SidebarDropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>(({ className, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn(SIDEBAR_MENU_ITEM_CLASSES, className)}
    {...props}
  />
));
SidebarDropdownMenuItem.displayName = 'SidebarDropdownMenuItem';

// Re-export separator unchanged (already styled correctly)
const SidebarDropdownMenuSeparator = DropdownMenuSeparator;

// ── Sidebar Context Menu composites ─────────────────────────────

const SidebarContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuContent>
>(({ className, ...props }, ref) => (
  <ContextMenuContent
    ref={ref}
    className={cn(SIDEBAR_MENU_CONTENT_CLASSES, className)}
    {...props}
  />
));
SidebarContextMenuContent.displayName = 'SidebarContextMenuContent';

const SidebarContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuItem>
>(({ className, ...props }, ref) => (
  <ContextMenuItem
    ref={ref}
    className={cn(SIDEBAR_MENU_ITEM_CLASSES, className)}
    {...props}
  />
));
SidebarContextMenuItem.displayName = 'SidebarContextMenuItem';

// Re-export separator unchanged
const SidebarContextMenuSeparator = ContextMenuSeparator;

export {
  SidebarDropdownMenuContent,
  SidebarDropdownMenuItem,
  SidebarDropdownMenuSeparator,
  SidebarContextMenuContent,
  SidebarContextMenuItem,
  SidebarContextMenuSeparator,
};
