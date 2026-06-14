export const AI_DISCLOSURE_TEXT = "This content is AI-assisted.";
export const AI_DISCLOSURE_HTML = `<p><em>${AI_DISCLOSURE_TEXT}</em></p>`;

const ESCAPED_DISCLOSURE_TEXT = AI_DISCLOSURE_TEXT.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);
const FIRST_DISCLOSURE_PARAGRAPH_PATTERN = new RegExp(
  `^\\s*<p(?:\\s+[^>]*)?>\\s*<em(?:\\s+[^>]*)?>\\s*${ESCAPED_DISCLOSURE_TEXT}\\s*<\\/em>\\s*<\\/p>`,
  "i",
);

export function stripLeadingAiDisclosure(body: string): {
  body: string;
  changed: boolean;
} {
  if (!FIRST_DISCLOSURE_PARAGRAPH_PATTERN.test(body)) {
    return { body, changed: false };
  }

  return {
    body: body.replace(FIRST_DISCLOSURE_PARAGRAPH_PATTERN, "").replace(/^\s+/, ""),
    changed: true,
  };
}

export function prependAiDisclosure(body: string): {
  body: string;
  changed: boolean;
} {
  if (body.trim().length === 0) {
    return { body, changed: false };
  }

  if (FIRST_DISCLOSURE_PARAGRAPH_PATTERN.test(body)) {
    return { body, changed: false };
  }

  return {
    body: `${AI_DISCLOSURE_HTML}${body}`,
    changed: true,
  };
}
