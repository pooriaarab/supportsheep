import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/error-utils";

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe(
      "something broke",
    );
  });

  it("returns string errors as-is", () => {
    expect(getErrorMessage("raw string error")).toBe("raw string error");
  });

  it("extracts message from object with message property", () => {
    expect(getErrorMessage({ message: "object error" })).toBe("object error");
  });

  it("returns fallback for null", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  it("returns fallback for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  it("returns fallback for number", () => {
    expect(getErrorMessage(42)).toBe("Unknown error");
  });

  it("returns fallback for object without message property", () => {
    expect(getErrorMessage({ code: 500 })).toBe("Unknown error");
  });

  it("returns fallback for object with non-string message", () => {
    expect(getErrorMessage({ message: 123 })).toBe("Unknown error");
  });

  it("handles TypeError", () => {
    expect(getErrorMessage(new TypeError("cannot read property"))).toBe(
      "cannot read property",
    );
  });
});
