import { describe, it, expect, vi, beforeEach } from "vitest";

const { useSession, signOut } = vi.hoisted(() => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/better-auth-client", () => ({
  authClient: { useSession, signOut },
}));

import { mapSessionUser } from "./auth-context";

describe("mapSessionUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a Better Auth user to AppUser", () => {
    expect(
      mapSessionUser({ id: "u1", email: "a@b.com", name: "A", image: "img" }),
    ).toEqual({ uid: "u1", email: "a@b.com", displayName: "A", photoURL: "img" });
  });

  it("returns null when there is no user", () => {
    expect(mapSessionUser(undefined)).toBeNull();
    expect(mapSessionUser(null)).toBeNull();
  });

  it("tolerates missing optional fields", () => {
    expect(mapSessionUser({ id: "u1", email: "a@b.com" })).toEqual({
      uid: "u1",
      email: "a@b.com",
      displayName: null,
      photoURL: null,
    });
  });
});
