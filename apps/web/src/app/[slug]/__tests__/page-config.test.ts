import { describe, expect, it } from "vitest";
import { dynamic } from "@/app/[slug]/page";

describe("root article page config", () => {
  it("serves root article pages dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
