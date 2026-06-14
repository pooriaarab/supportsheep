import { describe, it, expect } from "vitest";
import {
  applyRulesToText,
  deAiTellHtml,
  RULE_NAMES,
} from "@/lib/content/ai-tells";

describe("applyRulesToText", () => {
  it("returns input unchanged when no tells are present", () => {
    const input = "This sentence has no problematic words.";
    const result = applyRulesToText(input);
    expect(result.text).toBe(input);
    expect(result.changes).toHaveLength(0);
  });

  it("strips the 'seamless' adjective and keeps the following noun", () => {
    const result = applyRulesToText("Enable seamless integration across tools.");
    expect(result.text).toBe("Enable integration across tools.");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].rule).toBe("seamless");
  });

  it("rewrites 'seamlessly' to 'smoothly' preserving case", () => {
    const result = applyRulesToText("Seamlessly sync to the cloud.");
    expect(result.text).toBe("Smoothly sync to the cloud.");
    expect(result.changes[0].rule).toBe("seamlessly");
  });

  it("rewrites comprehensive, robust, and streamline", () => {
    const result = applyRulesToText(
      "A comprehensive, robust solution that streamlines workflows.",
    );
    expect(result.text).toBe(
      "A complete, reliable solution that simplifies workflows.",
    );
    expect(result.changes.map((c) => c.rule)).toEqual([
      "comprehensive",
      "robust",
      "streamline",
    ]);
  });

  it("leaves 'navigate' alone in geographic contexts", () => {
    const inputs = [
      "Users can navigate the website from any page.",
      "Navigate to the settings menu.",
      "We navigate the dashboard quickly.",
      "Navigate the site map for more options.",
    ];
    for (const input of inputs) {
      const result = applyRulesToText(input);
      expect(result.text).toBe(input);
      expect(result.changes).toHaveLength(0);
    }
  });

  it("rewrites 'navigate' in metaphorical contexts to 'handle'", () => {
    const result = applyRulesToText(
      "Teams must navigate the complexity of modern deployments.",
    );
    expect(result.text).toBe(
      "Teams must handle the complexity of modern deployments.",
    );
    expect(result.changes[0].rule).toBe("navigate");
  });

  it("rewrites 'leverage' and its conjugations to 'use' family", () => {
    const result = applyRulesToText(
      "We leverage AI; she leveraged data; they are leveraging pipelines.",
    );
    expect(result.text).toBe(
      "We use AI; she used data; they are using pipelines.",
    );
    expect(result.changes.every((c) => c.rule === "leverage")).toBe(true);
    expect(result.changes).toHaveLength(3);
  });

  it("rewrites 'landscape', 'foster', and 'delve'", () => {
    const result = applyRulesToText(
      "The evolving landscape fosters innovation; let's delve deeper.",
    );
    expect(result.text).toBe(
      "The evolving field builds innovation; let's explore deeper.",
    );
    const rules = result.changes.map((c) => c.rule).sort();
    expect(rules).toEqual(["delve", "foster", "landscape"]);
  });

  it("strips the 'In today's ...,' filler preamble and capitalizes the next clause", () => {
    const result = applyRulesToText(
      "In today's fast-paced world, AI tools shape the industry.",
    );
    expect(result.text).toBe("AI tools shape the industry.");
    expect(result.changes[0].rule).toBe("in-todays");
  });

  it("preserves original casing when stripping 'seamless'", () => {
    const result = applyRulesToText("Seamless integration is key.");
    // "Seamless " is removed -> "Integration" (capitalized from original I).
    expect(result.text).toBe("Integration is key.");
  });

  it("is idempotent -- a second pass yields zero changes", () => {
    const first = applyRulesToText(
      "A comprehensive, robust platform that leverages seamless workflows.",
    );
    const second = applyRulesToText(first.text);
    expect(second.text).toBe(first.text);
    expect(second.changes).toHaveLength(0);
  });

  it("includes a context snippet for every change", () => {
    const result = applyRulesToText(
      "The robust architecture handles scale gracefully.",
    );
    expect(result.changes[0].context).toContain("robust");
  });

  it("exposes a known list of rule names", () => {
    expect(RULE_NAMES).toEqual(
      expect.arrayContaining([
        "in-todays",
        "seamless",
        "seamlessly",
        "comprehensive",
        "robust",
        "streamline",
        "navigate",
        "leverage",
        "landscape",
        "foster",
        "delve",
      ]),
    );
  });
});

describe("deAiTellHtml", () => {
  it("returns empty string for empty input", () => {
    const result = deAiTellHtml("");
    expect(result.html).toBe("");
    expect(result.changes).toHaveLength(0);
  });

  it("rewrites text inside paragraphs but preserves tags", () => {
    const input =
      '<p>A <strong>comprehensive</strong> guide to robust systems.</p>';
    const result = deAiTellHtml(input);
    expect(result.html).toContain("<strong>complete</strong>");
    expect(result.html).toContain("reliable systems");
    expect(result.html).not.toContain("comprehensive");
    expect(result.html).not.toContain("robust");
  });

  it("does NOT touch text inside <code> blocks", () => {
    const input =
      '<p>Here is a call: <code>leverageConfig()</code> that leverages pipelines.</p>';
    const result = deAiTellHtml(input);
    // The `<code>` contents stay literal, but the outer prose is rewritten.
    expect(result.html).toContain("<code>leverageConfig()</code>");
    expect(result.html).toContain("uses pipelines");
  });

  it("does NOT touch text inside <pre> blocks", () => {
    const input =
      '<pre>const seamless = true;\n// comprehensive config</pre><p>A comprehensive plan.</p>';
    const result = deAiTellHtml(input);
    expect(result.html).toContain("const seamless = true;");
    expect(result.html).toContain("// comprehensive config");
    expect(result.html).toContain("A complete plan.");
  });

  it("does NOT touch attribute values like href or class", () => {
    const input =
      '<a href="/streamline-feature" class="robust-link">See docs</a>';
    const result = deAiTellHtml(input);
    expect(result.html).toContain('href="/streamline-feature"');
    expect(result.html).toContain('class="robust-link"');
    expect(result.changes).toHaveLength(0);
  });

  it("does not clobber nested HTML structure", () => {
    const input =
      "<article><section><p>The <em>landscape</em> evolves.</p></section></article>";
    const result = deAiTellHtml(input);
    expect(result.html).toContain("<article>");
    expect(result.html).toContain("<section>");
    expect(result.html).toContain("<em>field</em>");
  });

  it("records per-rule counts on the result", () => {
    const input =
      "<p>A comprehensive, robust, comprehensive plan leverages AI.</p>";
    const result = deAiTellHtml(input);
    expect(result.counts.comprehensive).toBe(2);
    expect(result.counts.robust).toBe(1);
    expect(result.counts.leverage).toBe(1);
  });

  it("is a no-op when only non-tell words appear", () => {
    const input = "<p>This is a clean sentence.</p>";
    const result = deAiTellHtml(input);
    expect(result.changes).toHaveLength(0);
    // rehype re-serializes, so HTML equivalence is checked semantically:
    expect(result.html).toContain("This is a clean sentence.");
  });

  it("handles a whole article body end-to-end", () => {
    const input = `
      <h2>Seamless Workflow</h2>
      <p>In today's fast-paced world, teams need robust tools.</p>
      <p>We leverage AI to streamline content creation. Our comprehensive
      platform lets you navigate the complexity of modern publishing.</p>
      <pre><code>const seamless = config.robust;</code></pre>
    `;
    const result = deAiTellHtml(input);
    expect(result.html).toContain("<h2>Workflow</h2>");
    expect(result.html).toContain("Teams need reliable tools");
    expect(result.html).toContain("We use AI to simplify content creation");
    expect(result.html).toContain("complete");
    expect(result.html).toContain("handle the complexity");
    // Code block untouched
    expect(result.html).toContain("const seamless = config.robust;");
    expect(result.counts.seamless).toBe(1);
    expect(result.counts["in-todays"]).toBe(1);
    expect(result.counts.robust).toBe(1);
    expect(result.counts.leverage).toBe(1);
    expect(result.counts.streamline).toBe(1);
    expect(result.counts.comprehensive).toBe(1);
    expect(result.counts.navigate).toBe(1);
  });
});
