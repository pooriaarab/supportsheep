import type { UserRole } from "@repo/types";

/**
 * Roles that may potentially mint share links. The effective set is narrowed
 * by the workspace `blogConfig.interview.whoCanMintLinks` setting; this is
 * only the upper bound (used as a fallback when no config is supplied).
 */
const DEFAULT_MINTERS: ReadonlySet<UserRole> = new Set([
  "owner",
  "admin",
  "editor",
]);
const REVOKERS: ReadonlySet<UserRole> = new Set(["owner", "admin"]);

export type MinterRole = "owner" | "admin" | "editor";

/**
 * Checks if a user role is permitted to create/mint share links (F-004).
 *
 * When `effectiveMinters` is provided (resolved from
 * `blogConfig.interview.whoCanMintLinks`), the role must be in that set.
 * Owners and admins are always allowed regardless of the config — the
 * "who can mint" setting is intended to narrow the editor pool, not lock
 * out workspace administrators from their own management surface.
 */
export function canMintShareLink(
  role: UserRole,
  effectiveMinters?: ReadonlyArray<MinterRole> | ReadonlySet<MinterRole> | null,
): boolean {
  if (!DEFAULT_MINTERS.has(role)) return false;

  // Owners and admins always retain mint capability — the UI cannot remove
  // them, but a stale or hand-edited config could; guard against that here.
  if (role === "owner" || role === "admin") return true;

  if (!effectiveMinters) return true;

  const set =
    effectiveMinters instanceof Set
      ? (effectiveMinters as ReadonlySet<MinterRole>)
      : new Set(effectiveMinters as ReadonlyArray<MinterRole>);

  return set.has(role as MinterRole);
}

/**
 * Checks if a user role is permitted to revoke any share link in the workspace.
 */
export function canRevokeAnyShareLink(role: UserRole): boolean {
  return REVOKERS.has(role);
}
