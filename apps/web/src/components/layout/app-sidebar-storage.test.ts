import { describe, expect, it, vi } from "vitest";
import {
  readExpandedSidebarGroups,
  SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY,
  SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY,
  writeExpandedSidebarGroups,
} from "./app-sidebar-storage";

function createStorage(values: Record<string, string | null> = {}) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn(),
  };
}

describe("app sidebar storage", () => {
  it("reads expanded groups from the versioned key first", () => {
    const storage = createStorage({
      [SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY]: JSON.stringify(["Articles"]),
      [SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY]: JSON.stringify(["Legacy"]),
    });

    expect(readExpandedSidebarGroups(storage)).toEqual(["Articles"]);
  });

  it("falls back to the legacy key for existing users", () => {
    const storage = createStorage({
      [SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY]: JSON.stringify(["Media"]),
    });

    expect(readExpandedSidebarGroups(storage)).toEqual(["Media"]);
  });

  it("ignores malformed sidebar storage data", () => {
    const storage = createStorage({
      [SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY]: JSON.stringify([42]),
      [SIDEBAR_EXPANDED_GROUPS_LEGACY_STORAGE_KEY]: "not-json",
    });

    expect(readExpandedSidebarGroups(storage)).toEqual([]);
  });

  it("writes expanded groups to the versioned key", () => {
    const storage = createStorage();

    writeExpandedSidebarGroups(storage, ["Articles", "Settings"]);

    expect(storage.setItem).toHaveBeenCalledWith(
      SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY,
      JSON.stringify(["Articles", "Settings"]),
    );
  });
});
