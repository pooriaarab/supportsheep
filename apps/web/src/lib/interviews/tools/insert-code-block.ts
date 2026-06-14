import { z } from "zod";
import type { Tool } from "./_types";

/**
 * Allowlist of language identifiers passed through to the TipTap
 * `CodeBlockLowlight` extension. Constraining the list prevents the
 * model from inventing language names the lowlight registry can't
 * highlight; everything outside the list is rejected at validation
 * time so the editor doesn't render a code block with broken
 * highlighting.
 */
export const CODE_BLOCK_LANGUAGES = [
  "ts",
  "js",
  "py",
  "bash",
  "sql",
  "json",
  "tsx",
  "html",
  "css",
  "yaml",
  "md",
  "text",
] as const;

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  language: z.enum(CODE_BLOCK_LANGUAGES),
  code: z.string().min(1).max(20_000),
});

/**
 * Insert a syntax-highlighted code block into a section. The language
 * is validated against `CODE_BLOCK_LANGUAGES` — values outside the
 * list return a structured validation error rather than degrading to
 * plain text, so the model gets a chance to re-emit with a supported
 * language.
 */
export default {
  name: "insert_code_block",
  description:
    "Insert a syntax-highlighted code block. Language must be one of: ts, js, py, bash, sql, json, tsx, html, css, yaml, md, text.",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "code_block",
      language: args.language,
      code: args.code,
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId }, summary: "code_block_inserted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
