/**
 * Human-friendly present-tense labels for every canvas tool exposed to the
 * realtime model. Used by the in-call orb's tool-call indicator chip so users
 * see "Setting the title…" instead of `set_title` while the AI works.
 *
 * Keep entries in sync with `apps/web/src/lib/interviews/tools/index.ts` —
 * unknown tool names fall back to a Title Case humanization of the snake_case
 * tool name, so missing entries degrade gracefully rather than breaking the
 * indicator.
 */
export const TOOL_LABELS: Record<string, string> = {
  // Title / meta
  set_title: "Setting the title",
  set_subtitle: "Setting the subtitle",
  set_slug: "Setting the slug",
  set_seo_meta: "Updating SEO metadata",
  set_categories: "Setting categories",
  set_tags: "Setting tags",
  set_keywords: "Setting keywords",

  // Sections
  insert_section: "Adding a section",
  rename_section: "Renaming a section",
  delete_section: "Removing a section",
  move_section: "Reordering sections",
  merge_sections: "Merging sections",
  set_heading_level: "Adjusting heading level",
  add_heading: "Adding a heading",
  finalize_section: "Finalizing the section",

  // Paragraphs / text
  insert_paragraph: "Adding a paragraph",
  delete_paragraph: "Removing a paragraph",
  move_paragraph: "Reordering a paragraph",
  replace_text: "Refining a paragraph",
  split_paragraph: "Splitting a paragraph",
  join_paragraphs: "Merging paragraphs",
  set_alignment: "Adjusting alignment",
  start_paragraph: "Starting a paragraph",

  // Bullets / lists
  add_bullet: "Adding a bullet",
  add_list_item: "Adding a list item",
  complete_list_item: "Completing a list item",
  convert_to_bullet_list: "Converting to a bullet list",
  convert_to_checklist: "Converting to a checklist",
  convert_to_numbered_list: "Converting to a numbered list",
  nest_list_item: "Nesting a list item",

  // Quotes / blocks
  add_quote: "Adding a quote",
  insert_blockquote: "Adding a blockquote",
  insert_callout: "Adding a callout",
  insert_code_block: "Adding a code block",
  insert_divider: "Adding a divider",
  insert_table: "Adding a table",

  // Marks (inline formatting)
  apply_bold: "Bolding text",
  apply_italic: "Italicizing text",
  apply_underline: "Underlining text",
  apply_strike: "Striking through text",
  apply_code: "Marking inline code",
  apply_highlight: "Highlighting text",
  apply_link: "Adding a link",
  clear_formatting: "Clearing formatting",

  // Embeds
  embed_codepen: "Embedding a CodePen",
  embed_gist: "Embedding a Gist",
  embed_iframe: "Embedding an iframe",
  embed_loom: "Embedding a Loom",
  embed_tweet: "Embedding a tweet",
  embed_youtube: "Embedding a YouTube video",

  // Images
  insert_inline_image: "Inserting an inline image",
  replace_inline_image: "Replacing an inline image",
  set_alt_text: "Setting alt text",
  request_featured_image: "Generating a featured image",
  regenerate_featured_image: "Regenerating the featured image",

  // SEO / internal linking
  request_seo_score: "Scoring SEO",
  suggest_internal_links: "Suggesting internal links",
  add_internal_link: "Adding an internal link",

  // Read tools
  get_section: "Reading a section",
  get_current_state: "Reading the canvas",
  get_word_count: "Counting words",
};

/**
 * Resolve a tool name to a human-friendly present-tense label. Falls back to
 * Title Case humanization of the snake_case name when the tool isn't in
 * `TOOL_LABELS` so brand-new tools still render readably without code changes.
 */
export function labelForTool(name: string): string {
  return TOOL_LABELS[name] ?? humanize(name);
}

function humanize(name: string): string {
  if (!name) return "";
  return name
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}
