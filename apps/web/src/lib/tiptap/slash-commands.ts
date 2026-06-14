/**
 * Slash Commands TipTap Extension
 *
 * Shows a floating command menu when the user types "/" at the start
 * of a line or after whitespace. Filters items as the user types,
 * supports keyboard navigation, and executes the selected command.
 *
 * Adapted for BlogBat from an admin slash-commands pattern.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export interface SlashCommandState {
  active: boolean;
  query: string;
  /** Document position where "/" was typed */
  slashPos: number;
  /** Screen coordinates for positioning the menu */
  coords: { top: number; left: number } | null;
}

const INITIAL_STATE: SlashCommandState = {
  active: false,
  query: "",
  slashPos: 0,
  coords: null,
};

export const slashCommandPluginKey = new PluginKey<SlashCommandState>(
  "slashCommands",
);

export interface SlashCommandsOptions {
  /** Callback invoked whenever the slash command state changes */
  onStateChange?: (state: SlashCommandState) => void;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      onStateChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;
    const editor = this.editor;

    const notifyStateChange = (state: SlashCommandState) => {
      extensionOptions.onStateChange?.(state);
    };

    const closeMenu = (view: EditorView) => {
      const state = slashCommandPluginKey.getState(view.state);
      if (state?.active) {
        view.dispatch(
          view.state.tr.setMeta(slashCommandPluginKey, INITIAL_STATE),
        );
        notifyStateChange(INITIAL_STATE);
      }
    };

    /**
     * Execute a slash command item. Deletes the /query text first,
     * then runs the command.
     */
    const executeCommand = (
      view: EditorView,
      slashPos: number,
      cursorPos: number,
      command: (ctx: { editor: typeof editor }) => void,
    ) => {
      // Delete the "/" and any query text
      const tr = view.state.tr.delete(slashPos, cursorPos);
      tr.setMeta(slashCommandPluginKey, INITIAL_STATE);
      view.dispatch(tr);
      notifyStateChange(INITIAL_STATE);

      // Execute the command
      command({ editor });
    };

    // Expose executeCommand on the editor for the React component to call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any)._slashCommandExecute = executeCommand;

    const plugin = new Plugin<SlashCommandState>({
      key: slashCommandPluginKey,

      state: {
        init(): SlashCommandState {
          return INITIAL_STATE;
        },
        apply(tr, prev): SlashCommandState {
          const meta = tr.getMeta(slashCommandPluginKey) as
            | SlashCommandState
            | undefined;
          if (meta !== undefined) return meta;

          // If menu is active and doc changed, update query
          if (prev.active && tr.docChanged) {
            const newSlashPos = tr.mapping.map(prev.slashPos);
            const newFrom = tr.selection?.from ?? tr.doc.content.size;

            // Read text between slash position and cursor
            if (newFrom > newSlashPos) {
              try {
                const text = tr.doc.textBetween(newSlashPos, newFrom);
                // Must start with /
                if (text.startsWith("/")) {
                  return {
                    ...prev,
                    query: text.slice(1),
                    slashPos: newSlashPos,
                  };
                }
              } catch {
                // Position out of bounds
              }
            }
            // Close menu if text no longer starts with /
            return INITIAL_STATE;
          }

          // Close menu on selection change without doc change (click elsewhere)
          if (prev.active && !tr.docChanged && tr.selectionSet) {
            const newFrom = tr.selection?.from ?? 0;
            if (
              newFrom <= prev.slashPos ||
              newFrom > prev.slashPos + prev.query.length + 1 + 10
            ) {
              return INITIAL_STATE;
            }
          }

          return prev;
        },
      },

      props: {
        handleKeyDown(view, event) {
          const state = slashCommandPluginKey.getState(view.state);

          // If menu is active, handle navigation keys
          if (state?.active) {
            if (
              event.key === "ArrowUp" ||
              event.key === "ArrowDown" ||
              event.key === "Enter"
            ) {
              // Dispatch a custom event for the React menu component
              const menuEvent = new CustomEvent("slash-command-keydown", {
                detail: { key: event.key },
              });
              document.dispatchEvent(menuEvent);
              event.preventDefault();
              return true;
            }

            if (event.key === "Escape") {
              closeMenu(view);
              event.preventDefault();
              return true;
            }
          }

          return false;
        },

        handleTextInput(view, from, _to, text) {
          // Detect "/" being typed at start of line or after whitespace
          if (text === "/") {
            const $pos = view.state.doc.resolve(from);
            const textBefore = $pos.parent.textBetween(
              0,
              $pos.parentOffset,
              undefined,
              "\ufffc",
            );

            // Only trigger at start of line or after whitespace
            if (textBefore.length === 0 || /\s$/.test(textBefore)) {
              setTimeout(() => {
                const coords = view.coordsAtPos(from + 1);
                const newState: SlashCommandState = {
                  active: true,
                  query: "",
                  slashPos: from,
                  coords: { top: coords.bottom, left: coords.left },
                };
                view.dispatch(
                  view.state.tr.setMeta(slashCommandPluginKey, newState),
                );
                notifyStateChange(newState);
              }, 0);
            }
          }

          return false;
        },
      },

      view() {
        // Track the snapshot we most recently handed to React so we can
        // skip no-op notifications. `view.update` fires on *every*
        // transaction — including plugin-only meta dispatches such as
        // `setAiCursor` from the AI-cursor extension — and if every fire
        // produces a referentially fresh `updated` object the React
        // `setSlashState` listener will trigger a re-render. When the
        // parent component re-renders TipTap re-runs `setOptions` (because
        // any object-literal `editorProps` is `!==` the previous), which
        // dispatches yet another transaction (`view.updateState`) — and
        // the cycle exhausts React's update-depth budget. Bailing out on
        // an unchanged snapshot breaks the feedback loop without
        // sacrificing freshness when the slash menu's coords / query
        // actually move.
        let lastNotified: SlashCommandState | null = null;

        return {
          update(view) {
            const state = slashCommandPluginKey.getState(view.state);
            if (!state?.active) {
              if (lastNotified && lastNotified.active) {
                lastNotified = INITIAL_STATE;
                notifyStateChange(INITIAL_STATE);
              }
              return;
            }

            try {
              const coords = view.coordsAtPos(state.slashPos + 1);
              const nextCoords = { top: coords.bottom, left: coords.left };
              if (
                lastNotified &&
                lastNotified.active === state.active &&
                lastNotified.query === state.query &&
                lastNotified.slashPos === state.slashPos &&
                lastNotified.coords?.top === nextCoords.top &&
                lastNotified.coords?.left === nextCoords.left
              ) {
                return;
              }
              const updated: SlashCommandState = {
                ...state,
                coords: nextCoords,
              };
              lastNotified = updated;
              notifyStateChange(updated);
            } catch {
              closeMenu(view);
            }
          },

          destroy() {
            notifyStateChange(INITIAL_STATE);
          },
        };
      },
    });

    return [plugin];
  },
});
