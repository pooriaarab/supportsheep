import { describe, test, expect } from "vitest";
import { stripUndefined } from "./strip-undefined";

describe("stripUndefined", () => {
  test("Removes top-level undefined values", () => {
    const result = stripUndefined({
      a: 1,
      b: undefined,
      c: "hello",
      d: undefined,
    });

    expect(result).toEqual({ a: 1, c: "hello" });
    expect(result).not.toHaveProperty("b");
    expect(result).not.toHaveProperty("d");
  });

  test("Preserves null, empty strings, false, and 0", () => {
    const result = stripUndefined({
      a: null,
      b: "",
      c: false,
      d: 0,
      e: undefined,
    });

    expect(result).toEqual({ a: null, b: "", c: false, d: 0 });
  });

  test("Preserves nested objects as-is (shallow only)", () => {
    const nested = { keep: 1, drop: undefined };
    const result = stripUndefined({ nested });

    // Nested object untouched — stripUndefined is shallow by design.
    expect(result.nested).toBe(nested);
    expect((result.nested as Record<string, unknown>).drop).toBeUndefined();
  });

  test("Returns an empty object when all values are undefined", () => {
    const result = stripUndefined({ a: undefined, b: undefined });
    expect(result).toEqual({});
  });
});
