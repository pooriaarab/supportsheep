import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TableOfContents } from "@/components/public/toc";

describe("TableOfContents", () => {
  it("returns null when toc is disabled in the article theme", () => {
    const markup = renderToStaticMarkup(
      <TableOfContents
        headings={[{ id: "one", text: "One", level: 2 }]}
        theme={{ enabled: false, containerClassName: "rounded-xl border" }}
      />,
    );

    expect(markup).toBe("");
  });

  it("applies the themed container classes when toc is enabled", () => {
    const markup = renderToStaticMarkup(
      <TableOfContents
        headings={[{ id: "one", text: "One", level: 2 }]}
        theme={{ enabled: true, containerClassName: "rounded-xl border p-6" }}
      />,
    );

    expect(markup).toContain("rounded-xl");
    expect(markup).toContain("On this page");
  });
});
