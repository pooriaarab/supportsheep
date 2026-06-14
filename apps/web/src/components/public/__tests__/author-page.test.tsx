import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorPage } from "@/components/public/author-page";
import type { Author } from "@repo/types";

const author: Author = {
  id: "jane-doe",
  name: "Jane Doe",
  jobTitle: "Senior Editor",
  bio: "Jane covers launching small-business websites.",
  avatarUrl: "https://cdn.example.com/jane.png",
  email: "jane@example.com",
  sameAs: [
    "https://www.linkedin.com/in/jane-doe",
    "https://github.com/jane-doe",
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("AuthorPage", () => {
  it("renders Person JSON-LD with the full rich profile", () => {
    const html = renderToStaticMarkup(
      <AuthorPage
        author={author}
        articles={[]}
        siteUrl="https://supportsheep.com"
      />,
    );

    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"@context":"https://schema.org"');
    expect(html).toContain('"name":"Jane Doe"');
    expect(html).toContain('"jobTitle":"Senior Editor"');
    expect(html).toContain('"url":"https://supportsheep.com/authors/jane-doe"');
    expect(html).toContain('"image":"https://cdn.example.com/jane.png"');
    expect(html).toContain(
      '"sameAs":["https://www.linkedin.com/in/jane-doe","https://github.com/jane-doe"]',
    );
  });

  it("renders the visible bio, job title, and external profile links", () => {
    const html = renderToStaticMarkup(
      <AuthorPage
        author={author}
        articles={[]}
        siteUrl="https://supportsheep.com"
      />,
    );

    expect(html).toContain("Jane Doe");
    expect(html).toContain("Senior Editor");
    expect(html).toContain("Jane covers launching small-business websites.");
    expect(html).toContain('href="https://www.linkedin.com/in/jane-doe"');
    expect(html).toContain("linkedin.com");
    expect(html).toContain("No articles published by this author yet.");
  });

  it("omits optional schema fields when the author is minimal", () => {
    const minimal: Author = {
      id: "pat",
      name: "Pat",
      bio: "",
      createdAt: author.createdAt,
      updatedAt: author.updatedAt,
    };

    const html = renderToStaticMarkup(
      <AuthorPage
        author={minimal}
        articles={[]}
        siteUrl="https://supportsheep.com"
      />,
    );

    expect(html).toContain('"name":"Pat"');
    expect(html).not.toContain('"jobTitle"');
    expect(html).not.toContain('"description"');
    expect(html).not.toContain('"image"');
    expect(html).not.toContain('"email"');
    expect(html).not.toContain('"sameAs"');
  });
});
