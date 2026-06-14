import { describe, it, expect } from "vitest";
import { NAMED_AUTHORS } from "../authors-catalog";

describe("NAMED_AUTHORS seed", () => {
  it("includes Pooria Arab with LinkedIn sameAs", () => {
    const pooria = NAMED_AUTHORS.find((a) => a.id === "pooria-arab");
    expect(pooria).toBeDefined();
    expect(pooria?.name).toBe("Pooria Arab");
    expect(pooria?.sameAs).toContain("https://linkedin.com/in/pooriaarab");
  });

  it("includes Madison Carter", () => {
    const madison = NAMED_AUTHORS.find((a) => a.id === "madison-carter");
    expect(madison).toBeDefined();
    expect(madison?.name).toBe("Madison Carter");
  });

  it("every author has a unique slug id", () => {
    const ids = NAMED_AUTHORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
