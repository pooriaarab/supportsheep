import { describe, expect, it } from "vitest";
import { buildCalloutUrl } from "./callout";

describe("free tool callouts", () => {
  it("adds safe UTM parameters to https URLs", () => {
    expect(
      buildCalloutUrl({
        baseUrl: "https://blogbat.com/",
        toolSlug: "blog-outline-generator",
        utm: {
          source: "solo_blog",
          medium: "free_tool",
          campaign: "{{toolSlug}}",
          content: "bottom_callout",
          term: "",
        },
      }),
    ).toBe(
      "https://blogbat.com/?utm_source=solo_blog&utm_medium=free_tool&utm_campaign=blog-outline-generator&utm_content=bottom_callout",
    );
  });

  it("replaces existing UTM parameters and keeps non-UTM parameters", () => {
    expect(
      buildCalloutUrl({
        baseUrl:
          "https://blogbat.com/start?ref=blog&utm_source=old&utm_campaign=old",
        toolSlug: "word-counter",
        utm: {
          source: "solo_blog",
          medium: "free_tool",
          campaign: "{{toolSlug}}",
          content: "",
          term: "word counter",
        },
      }),
    ).toBe(
      "https://blogbat.com/start?ref=blog&utm_source=solo_blog&utm_campaign=word-counter&utm_medium=free_tool&utm_term=word+counter",
    );
  });

  it("rejects non-https callout destinations", () => {
    expect(() =>
      buildCalloutUrl({
        baseUrl: "http://blogbat.com/",
        toolSlug: "word-counter",
        utm: {
          source: "solo_blog",
          medium: "free_tool",
          campaign: "{{toolSlug}}",
          content: "bottom_callout",
          term: "",
        },
      }),
    ).toThrow("Callout URLs must use https://");
  });
});
