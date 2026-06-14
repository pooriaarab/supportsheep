/**
 * Tiptap editor setup — re-exports the shared editor configuration.
 *
 * Import from "@/lib/tiptap" for the standard editor extensions.
 */

export { getEditorExtensions, type EditorExtensionsOptions } from "./extensions";
export {
  SlashCommands,
  slashCommandPluginKey,
  type SlashCommandState,
  type SlashCommandsOptions,
} from "./slash-commands";
export {
  Callout,
  CALLOUT_VARIANTS,
  type CalloutOptions,
  type CalloutVariant,
} from "./nodes/callout";
export { Figure, type FigureOptions } from "./nodes/figure";
export { insertImageViaUpload } from "./image-upload";
export { AiCursor, aiCursorPluginKey, type AiCursorState } from "./ai-cursor";
export {
  HumanCursor,
  humanCursorPluginKey,
  type HumanCursorState,
} from "./human-cursor";
export {
  AiSawItDecoration,
  aiSawItPluginKey,
  allocateAiSawItId,
  type AiSawItPhase,
  type AiSawItEntry,
  type AiSawItState,
} from "./ai-saw-it-decoration";
export {
  AiReadingScanner,
  aiReadingScannerPluginKey,
  allocateAiReadingScanId,
  type AiReadingScannerEntry,
  type AiReadingScannerState,
} from "./ai-reading-scanner";
