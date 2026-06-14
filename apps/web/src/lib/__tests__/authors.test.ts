import { describe, expect, it } from "vitest";
import {
  buildAuthorJsonLd,
  buildAuthorPersonSchema,
  getAuthorPath,
} from "@/lib/authors";
import type { Author } from "@repo/types";

const baseAuthor: Author = {
  id: "jane-doe",
  name: "Jane Doe",
  jobTitle: "Senior Editor",
  bio: "Jane writes about small business on the web.",
  avatarUrl: "https://cdn.example.com/jane.png",
  email: "jane@example.com",
  sameAs: [
    "https://www.linkedin.com/in/jane-doe",
    "https://github.com/jane-doe",
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("getAuthorPath", () => {
  it("builds the canonical /authors/{slug} path", () => {
    expect(getAuthorPath("jane-doe")).toBe("/authors/jane-doe");
  });
});

describe("buildAuthorPersonSchema", () => {
  it("emits a schema.org Person with every rich field", () => {
    const schema = buildAuthorPersonSchema(baseAuthor, "https://blog.example.com");
    expect(schema).toMatchObject({
      "@type": "Person",
      name: "Jane Doe",
      url: "https://blog.example.com/authors/jane-doe",
      jobTitle: "Senior Editor",
      description: baseAuthor.bio,
      image: baseAuthor.avatarUrl,
      email: baseAuthor.email,
      sameAs: baseAuthor.sameAs,
    });
  });

  it("omits optional fields when missing (no empty strings or empty arrays)", () => {
    const minimalAuthor: Author = {
      id: "pat",
      name: "Pat",
      bio: "",
      createdAt: baseAuthor.createdAt,
      updatedAt: baseAuthor.updatedAt,
    };
    const schema = buildAuthorPersonSchema(minimalAuthor, "https://blog.example.com");

    expect(schema).toEqual({
      "@type": "Person",
      name: "Pat",
      url: "https://blog.example.com/authors/pat",
    });
    expect(schema).not.toHaveProperty("jobTitle");
    expect(schema).not.toHaveProperty("description");
    expect(schema).not.toHaveProperty("image");
    expect(schema).not.toHaveProperty("email");
    expect(schema).not.toHaveProperty("sameAs");
  });
});

describe("buildAuthorJsonLd", () => {
  it("wraps the Person schema with @context for top-level JSON-LD", () => {
    const jsonLd = buildAuthorJsonLd(baseAuthor, "https://blog.example.com");
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Person");
    expect(jsonLd.url).toBe("https://blog.example.com/authors/jane-doe");
  });
});
