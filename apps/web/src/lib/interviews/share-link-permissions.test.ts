import { describe, expect, it } from "vitest";
import type { UserRole } from "@repo/types";
import {
  canMintShareLink,
  canRevokeAnyShareLink,
} from "./share-link-permissions";

describe("share-link-permissions", () => {
  const roles: UserRole[] = [
    "owner",
    "admin",
    "editor",
    "author",
    "guest",
    "member",
    "viewer",
  ];

  describe("canMintShareLink", () => {
    const expectedMint: Record<UserRole, boolean> = {
      owner: true,
      admin: true,
      editor: true,
      author: false,
      guest: false,
      member: false,
      viewer: false,
    };

    roles.forEach((role) => {
      it(`should return ${expectedMint[role]} for ${role}`, () => {
        expect(canMintShareLink(role)).toBe(expectedMint[role]);
      });
    });
  });

  describe("canMintShareLink with effective minters (F-004)", () => {
    it("respects the workspace whoCanMintLinks setting for editors", () => {
      // Workspace owner unchecked "editor" in Settings → Interview.
      const effective = ["owner", "admin"] as const;
      expect(canMintShareLink("editor", effective)).toBe(false);
      expect(canMintShareLink("admin", effective)).toBe(true);
      expect(canMintShareLink("owner", effective)).toBe(true);
    });

    it("still allows owners and admins even if the config tries to exclude them", () => {
      // Defensive: a hand-edited or stale config should never lock workspace
      // administrators out of their own management surface.
      const effective = ["editor"] as const;
      expect(canMintShareLink("owner", effective)).toBe(true);
      expect(canMintShareLink("admin", effective)).toBe(true);
    });

    it("returns false for non-default minters regardless of config", () => {
      const effective = ["owner", "admin", "editor"] as const;
      expect(canMintShareLink("guest", effective)).toBe(false);
      expect(canMintShareLink("viewer", effective)).toBe(false);
      expect(canMintShareLink("author", effective)).toBe(false);
    });

    it("falls back to the default set when no effective minters are provided", () => {
      expect(canMintShareLink("editor")).toBe(true);
      expect(canMintShareLink("editor", null)).toBe(true);
    });
  });

  describe("canRevokeAnyShareLink", () => {
    const expectedRevoke: Record<UserRole, boolean> = {
      owner: true,
      admin: true,
      editor: false,
      author: false,
      guest: false,
      member: false,
      viewer: false,
    };

    roles.forEach((role) => {
      it(`should return ${expectedRevoke[role]} for ${role}`, () => {
        expect(canRevokeAnyShareLink(role)).toBe(expectedRevoke[role]);
      });
    });
  });
});
