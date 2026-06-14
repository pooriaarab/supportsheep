/**
 * Resolves the effective `whoCanMintLinks` set for the current workspace from
 * `blogConfig.interview`. Centralising the read here keeps the permission
 * helper (`canMintShareLink`) pure and synchronous while still letting all
 * call-sites (route handlers, server components) consume the actual config
 * value rather than the hardcoded default.
 *
 * This closes F-004: previously the UI persisted `whoCanMintLinks` but the
 * permission check ignored it, so unchecking "editor" in Settings → Interview
 * had no runtime effect.
 */

import { getBlogConfig } from "@/lib/blog-config";
import type { MinterRole } from "@/lib/interviews/share-link-permissions";

const DEFAULT_MINTER_LIST: readonly MinterRole[] = [
  "owner",
  "admin",
  "editor",
];

export async function getBlogConfigEffectiveMinters(): Promise<
  readonly MinterRole[]
> {
  try {
    const config = await getBlogConfig();
    const list = config?.interview?.whoCanMintLinks;
    if (Array.isArray(list) && list.length > 0) {
      return list as readonly MinterRole[];
    }
  } catch {
    // Fall through to defaults.
  }
  return DEFAULT_MINTER_LIST;
}
