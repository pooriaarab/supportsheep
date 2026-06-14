export const SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY =
  "sidebar-expanded-groups:v1";
export const SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY =
  "sidebar-expanded-groups";

type SidebarGroupsStorage = Pick<Storage, "getItem" | "setItem">;

function parseExpandedGroups(value: string | null): string[] | null {
  if (value === null) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item) => typeof item === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readStorageKey(
  storage: SidebarGroupsStorage,
  key: string,
): string[] | null {
  try {
    return parseExpandedGroups(storage.getItem(key));
  } catch {
    return null;
  }
}

export function readExpandedSidebarGroups(
  storage: SidebarGroupsStorage,
): string[] {
  const versionedGroups = readStorageKey(
    storage,
    SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY,
  );
  if (versionedGroups !== null) return versionedGroups;

  return (
    readStorageKey(storage, SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY) ?? []
  );
}

export function writeExpandedSidebarGroups(
  storage: SidebarGroupsStorage,
  groups: string[],
) {
  try {
    storage.setItem(
      SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY,
      JSON.stringify(groups),
    );
  } catch {}
}
