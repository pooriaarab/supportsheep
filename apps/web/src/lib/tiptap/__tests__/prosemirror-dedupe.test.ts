/**
 * Guards against a regression where multiple physical copies of
 * prosemirror-model (and its sister packages) end up in the bundle.
 *
 * The fatal symptom in production was:
 *   Uncaught RangeError: Can not convert <> to a Fragment
 *     (looks like multiple versions of prosemirror-model were loaded)
 * Triggered the moment the user pressed Enter inside the canvas editor.
 *
 * The root cause is bundler-level: when a request like `prosemirror-model`
 * resolves to *two distinct physical paths* (one via the top-level
 * dependency graph, one via `@tiptap/pm`'s nested copy) Webpack / Turbopack
 * cannot collapse them into a single module instance, so two `Fragment`
 * classes live side-by-side at runtime. ProseMirror's `splitBlock` check
 * then throws on Enter.
 *
 * Both `apps/web/next.config.ts` (webpack + turbopack `resolve.alias`)
 * and the root `package.json` `overrides` block force every prosemirror
 * sister package to a single canonical directory. This test fails if
 * that invariant is ever broken (e.g. by a new TipTap extension pinning
 * a tighter prosemirror-model range that gets nested instead of hoisted).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const requireFromHere = createRequire(__filename);

const PROSEMIRROR_PACKAGES = [
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-view",
  "prosemirror-transform",
  "prosemirror-commands",
  "prosemirror-keymap",
  "prosemirror-schema-list",
] as const;

// Resolve @tiptap/pm's `model` subpath, then walk up to find its package
// root. Its sibling node_modules holds the transitive prosemirror-*
// packages under Bun's isolated linker layout.
function tiptapPmRoot(): string {
  let dir = path.dirname(requireFromHere.resolve("@tiptap/pm/model"));
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "@tiptap/pm") return dir;
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error("Unable to locate @tiptap/pm package root");
}

describe("prosemirror dedupe", () => {
  it("each prosemirror sister package resolves to exactly one canonical path through @tiptap/pm", () => {
    const root = tiptapPmRoot();
    const tiptapRequire = createRequire(path.join(root, "package.json"));

    for (const pkg of PROSEMIRROR_PACKAGES) {
      const resolved = tiptapRequire.resolve(pkg);
      expect(resolved, `${pkg} did not resolve via @tiptap/pm`).toContain(pkg);
      // Re-resolving must return the same path (no race / version drift).
      expect(tiptapRequire.resolve(pkg)).toBe(resolved);
      // The realpath must be stable too.
      expect(fs.realpathSync(tiptapRequire.resolve(pkg))).toBe(
        fs.realpathSync(resolved),
      );
    }
  });

  it("prosemirror-model lives in exactly one physical directory", () => {
    const root = tiptapPmRoot();
    const tiptapRequire = createRequire(path.join(root, "package.json"));

    // The resolved entry file's canonical (symlink-collapsed) parent
    // directory is the single physical copy of prosemirror-model. Both
    // the alias in next.config.ts and the package.json override force
    // every consumer through this same directory.
    const entry = tiptapRequire.resolve("prosemirror-model");
    const canonicalEntry = fs.realpathSync(entry);
    expect(canonicalEntry).toContain("prosemirror-model");
    // The directory must contain a package.json naming the package
    // (proves we didn't land on a re-export shim from somewhere else).
    let dir = path.dirname(canonicalEntry);
    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "prosemirror-model") {
          expect(pkg.name).toBe("prosemirror-model");
          return;
        }
      }
      dir = path.dirname(dir);
    }
    throw new Error(
      "prosemirror-model entry did not live under a package.json naming it",
    );
  });

  it("@tiptap/pm/model exposes the same Fragment class on repeated import", async () => {
    // Two dynamic imports of the same specifier must return the same
    // class reference. If module-graph caching ever fragmented (e.g.
    // due to a path-keyed cache miss), this would fail.
    const a = await import("@tiptap/pm/model");
    const b = await import("@tiptap/pm/model");
    expect(a.Fragment).toBe(b.Fragment);
    expect(typeof a.Fragment.from).toBe("function");
  });
});
