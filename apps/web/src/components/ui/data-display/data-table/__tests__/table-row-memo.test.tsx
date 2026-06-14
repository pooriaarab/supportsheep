/**
 * Verifies that `TableRowComponent` is wrapped in `React.memo` so that
 * sibling rows do not re-render when only one row's state changes
 * (e.g. selection toggling, hover state on a different row).
 *
 * We can't run a full React renderer in the node-environment Vitest config
 * we use repo-wide, but `React.memo` returns an object with a
 * `$$typeof` of `Symbol.for("react.memo")` and a `compare` prop -- a quick
 * structural check is enough to guard against accidental regressions
 * (someone unwrapping the memo would fail this test immediately).
 */

import { describe, expect, it } from "vitest";
import { TableRowComponent } from "../table-row";

describe("TableRowComponent", () => {
  it("is wrapped in React.memo so sibling rows are skipped on parent re-render", () => {
    // React.memo returns an object whose `$$typeof` is the react.memo symbol.
    // The cast walks past the generic-preserving signature to the underlying
    // memo descriptor.
    const memoSymbol = Symbol.for("react.memo");
    const wrapped = TableRowComponent as unknown as {
      $$typeof?: symbol;
      type?: unknown;
    };
    expect(wrapped.$$typeof).toBe(memoSymbol);
    // The underlying component implementation is stored on `.type`.
    expect(typeof wrapped.type).toBe("function");
  });
});
