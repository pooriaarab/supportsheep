import { describe, expect, it } from "vitest";

import { classifyRequestTenant } from "./request-blog";

describe("classifyRequestTenant", () => {
  it("classifies a resolved tenant as a blog", () => {
    expect(classifyRequestTenant("acme.supportsheep.com", "b-acme")).toEqual({
      kind: "blog",
      blogId: "b-acme",
    });
    // A verified custom domain that resolved.
    expect(classifyRequestTenant("blog.acme.com", "b-acme")).toEqual({
      kind: "blog",
      blogId: "b-acme",
    });
  });

  it("classifies marketing hosts as marketing", () => {
    expect(classifyRequestTenant("supportsheep.com", null)).toEqual({
      kind: "marketing",
    });
    expect(classifyRequestTenant("www.supportsheep.com", null)).toEqual({
      kind: "marketing",
    });
    expect(classifyRequestTenant("localhost:3000", null)).toEqual({
      kind: "marketing",
    });
  });

  it("classifies an unknown *.supportsheep.com tenant subdomain as not-found", () => {
    expect(classifyRequestTenant("ghost.supportsheep.com", null)).toEqual({
      kind: "not-found",
    });
  });

  // The core edge case the `*/*` Worker route introduces: an arbitrary external
  // host now reaches the worker. If it isn't a verified blog it must 404, never
  // silently serve the default blog.
  it("classifies an unknown FOREIGN host as not-found (no default-blog fallback)", () => {
    expect(classifyRequestTenant("blog.supportsheepzilla.com", null)).toEqual({
      kind: "not-found",
    });
    expect(classifyRequestTenant("totally-unknown.example.org", null)).toEqual({
      kind: "not-found",
    });
    // An unverified/pending custom domain resolves to null → not-found too.
    expect(classifyRequestTenant("pending.example.com", null)).toEqual({
      kind: "not-found",
    });
  });

  it("keeps first-party platform hosts on marketing/default (never 404)", () => {
    // The SaaS fallback origin and dashboard/api hosts must keep working.
    expect(classifyRequestTenant("customers.supportsheep.com", null)).toEqual({
      kind: "marketing",
    });
    expect(classifyRequestTenant("app.supportsheep.com", null)).toEqual({
      kind: "marketing",
    });
    expect(classifyRequestTenant("staging.supportsheep.com", null)).toEqual({
      kind: "marketing",
    });
  });

  it("treats an empty host as marketing", () => {
    expect(classifyRequestTenant("", null)).toEqual({ kind: "marketing" });
  });
});
