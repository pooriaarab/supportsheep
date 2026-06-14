import { describe, it, expect } from "vitest";
import { generateImageSchema } from "@/lib/schemas";

describe("generateImageSchema", () => {
  it("accepts valid input with slug and purpose", () => {
    const result = generateImageSchema.safeParse({
      purpose: "featured-image",
      slug: "my-post-slug",
    });
    expect(result.success).toBe(true);
  });

  it("accepts inline purpose with title only", () => {
    const result = generateImageSchema.safeParse({
      purpose: "inline",
      title: "My Post Title",
    });
    expect(result.success).toBe(true);
  });

  it("rejects input with neither slug nor title nor customPrompt", () => {
    const result = generateImageSchema.safeParse({
      purpose: "inline",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(
      "Either slug, title, or customPrompt must be provided",
    );
  });

  it("accepts inline purpose with customPrompt only", () => {
    const result = generateImageSchema.safeParse({
      purpose: "inline",
      customPrompt: "A person cooking pasta in a sunny kitchen",
    });
    expect(result.success).toBe(true);
  });

  it("accepts featured-image purpose with slug and title", () => {
    const result = generateImageSchema.safeParse({
      purpose: "featured-image",
      slug: "my-post-slug",
      title: "My Post Title",
    });
    expect(result.success).toBe(true);
  });

  it("accepts inline purpose with slug only", () => {
    const result = generateImageSchema.safeParse({
      purpose: "inline",
      slug: "my-post-slug",
    });
    expect(result.success).toBe(true);
  });

  it("rejects featured-image purpose without slug", () => {
    const result = generateImageSchema.safeParse({
      purpose: "featured-image",
      title: "My Post Title",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("slug is required");
  });
});
