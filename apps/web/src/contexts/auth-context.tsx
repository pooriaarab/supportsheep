"use client";

/**
 * Authentication context provider, backed by Better Auth.
 *
 * Exposes a stable `{ user, loading, logout }` API via useAuth() so consumers
 * don't depend on the underlying auth provider. (Migrated off Firebase Auth.)
 */

import { createContext, use, useCallback, useMemo } from "react";

import { authClient } from "@/lib/auth/better-auth-client";

/** Minimal user shape exposed by the auth context. */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map a Better Auth session user to the context's AppUser shape. Exported for tests. */
export function mapSessionUser(
  u: { id: string; email?: string | null; name?: string | null; image?: string | null } | null | undefined,
): AppUser | null {
  if (!u) return null;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: u.name ?? null,
    photoURL: u.image ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  const sessionUser = session?.user;
  const user = useMemo(
    () => mapSessionUser(sessionUser),
    // Depend on primitive fields, not `sessionUser` (a fresh object each render),
    // so `user`'s identity stays stable unless a field actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionUser?.id, sessionUser?.email, sessionUser?.name, sessionUser?.image],
  );

  const logout = useCallback(async () => {
    await authClient.signOut();
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, loading: isPending, logout }),
    [user, isPending, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
