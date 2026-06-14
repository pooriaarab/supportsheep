"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@repo/ui/utils";

interface SidebarContextType {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mounted: boolean;
}

interface CommandPaletteContextType {
  open: boolean;
  setOpen: (value: SetStateAction<boolean>) => void;
}

interface NewThreadContextType {
  open: boolean;
  setOpen: (value: SetStateAction<boolean>) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);
const CommandPaletteContext = createContext<
  CommandPaletteContextType | undefined
>(undefined);
const NewThreadContext = createContext<NewThreadContextType | undefined>(
  undefined,
);

export function useSidebar() {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

export function useCommandPalette() {
  const context = use(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }
  return context;
}

export function useNewThread() {
  const context = use(NewThreadContext);
  if (!context) {
    throw new Error("useNewThread must be used within NewThreadProvider");
  }
  return context;
}

function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);

  // Memoize Provider values so consumers don't re-render every parent render.
  const commandPaletteValue = useMemo(() => ({ open, setOpen }), [open]);
  const newThreadValue = useMemo(
    () => ({ open: newThreadOpen, setOpen: setNewThreadOpen }),
    [newThreadOpen],
  );

  return (
    <CommandPaletteContext value={commandPaletteValue}>
      <NewThreadContext value={newThreadValue}>{children}</NewThreadContext>
    </CommandPaletteContext>
  );
}

// Sidebar collapsed state via useSyncExternalStore
// Avoids hydration mismatch and setState-in-effect lint violations.

const SIDEBAR_KEY = "sidebar-collapsed";
let sidebarListeners: (() => void)[] = [];

function subscribeSidebar(callback: () => void) {
  sidebarListeners = [...sidebarListeners, callback];
  return () => {
    sidebarListeners = sidebarListeners.filter((l) => l !== callback);
  };
}

function getSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_KEY) === "true";
}

function setSidebarCollapsed(value: boolean) {
  localStorage.setItem(SIDEBAR_KEY, String(value));
  sidebarListeners.forEach((l) => l());
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false,
  );

  const [mounted, setMounted] = useState(false);
  useMountEffect(() => setMounted(true));

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);

  // Memoize the context value so every consumer (every dashboard layout
  // descendant) doesn't re-render on every SidebarProvider render.
  const contextValue = useMemo(
    () => ({ collapsed, toggleCollapsed, mounted }),
    [collapsed, toggleCollapsed, mounted],
  );

  return (
    <SidebarContext value={contextValue}>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </SidebarContext>
  );
}

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, mounted } = useSidebar();

  return (
    <main
      suppressHydrationWarning
      className={cn(
        "flex-1 overflow-auto transition-[margin,padding] duration-300 relative z-0",
        mounted && collapsed ? "sm:ml-0" : "sm:ml-64",
      )}
    >
      {/* Add padding-top on mobile to account for fixed header */}
      {/* Add left padding when collapsed to account for floating toggle button */}
      <div
        suppressHydrationWarning
        className={cn(
          "h-full sm:pt-0 pt-10 transition-[margin,padding] duration-300",
          mounted && collapsed && "sm:pl-20",
        )}
      >
        {children}
      </div>
    </main>
  );
}
