import { describe, expect, it } from "vitest";
import {
  findMissingPublishedSlugs,
  parseWordPressXml,
  selectImportMatch,
} from "@/lib/import/wordpress";

describe("wordpress import identity", () => {
  it("extracts wordpress post identity and source path from xml", () => {
    const posts = parseWordPressXml(`
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">
        <channel>
          <item>
            <title><![CDATA[Test Post]]></title>
            <link>https://supportsheep.com/test-post/</link>
            <dc:creator><![CDATA[parab]]></dc:creator>
            <content:encoded><![CDATA[<p>Hello world</p>]]></content:encoded>
            <excerpt:encoded><![CDATA[<p>Excerpt</p>]]></excerpt:encoded>
            <wp:post_id>123</wp:post_id>
            <wp:post_date><![CDATA[2026-04-15 00:00:00]]></wp:post_date>
            <wp:post_modified><![CDATA[2026-04-15 00:00:00]]></wp:post_modified>
            <wp:post_name><![CDATA[test-post]]></wp:post_name>
            <wp:status><![CDATA[publish]]></wp:status>
            <wp:post_type><![CDATA[post]]></wp:post_type>
          </item>
        </channel>
      </rss>
    `);

    expect(posts).toHaveLength(1);
    expect(posts[0].wordpressPostId).toBe("123");
    expect(posts[0].sourceUrl).toBe("https://supportsheep.com/test-post/");
    expect(posts[0].sourcePath).toBe("/test-post/");
  });

  it("prefers wordpress id matches before slug matches", () => {
    const result = selectImportMatch({
      existingByWordPressId: { id: "wp-doc" },
      existingBySlug: { id: "slug-doc", wordpressPostId: null },
    });

    expect(result).toEqual({
      kind: "update",
      targetId: "wp-doc",
    });
  });

  it("finds published wordpress slugs missing from firestore", () => {
    const diff = findMissingPublishedSlugs({
      xmlPublishedSlugs: [
        "company-bio-example",
        "ideas-for-personal-websites",
      ],
      firestoreSlugs: ["ideas-for-personal-websites"],
    });

    expect(diff).toEqual(["company-bio-example"]);
  });
});
