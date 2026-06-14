/**
 * MentionTextarea — contentEditable div with @ mention support
 *
 * Uses a contentEditable div with non-editable inline mention elements instead
 * of a textarea + transparent-text overlay. This ensures the cursor position
 * always matches the visual content, even when mentions are rendered as styled
 * badges with different widths than their raw `@category:name` tokens.
 */

'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '../utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MentionCategory = 'agent' | 'flow' | 'template' | 'tool';

export interface MentionEntity {
  category: MentionCategory;
  id: string;
  name: string;
  displayName: string;
  emoji?: string;
  /** Custom avatar image URL (highest priority for avatar display) */
  avatarUrl?: string;
  /** Background color class for initial-based avatar fallback */
  avatarColor?: string;
}

export interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  entities: MentionEntity[];
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  minRows?: number;
  maxHeight?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  /**
   * Custom React renderer for entity icons in the **dropdown** only.
   * Inline mention badges use DOM APIs and fall back to the built-in
   * avatar/emoji/initial renderer. Use `renderEntityIconDOM` to customise
   * the icon inside inline badges.
   */
  renderEntityIcon?: (entity: MentionEntity, size: 'sm' | 'md') => React.ReactNode;
  /**
   * Optional DOM-based icon builder for inline mention badges.
   * Called during imperative DOM construction — return a DOM element
   * (e.g. an `<img>` or `<span>`) to prepend inside the badge.
   * When omitted the default avatar/emoji/initial logic is used.
   */
  renderEntityIconDOM?: (entity: MentionEntity) => HTMLElement | null;
}

export interface MentionTextareaRef {
  focus: () => void;
  /** @deprecated No longer backed by a textarea — always returns null */
  textarea: HTMLTextAreaElement | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<MentionCategory, string> = {
  agent: 'Agents',
  flow: 'Flows',
  template: 'Templates',
  tool: 'Tools',
};

const CATEGORY_ORDER: MentionCategory[] = ['agent', 'flow', 'template', 'tool'];

/** Regex to detect @mention tokens in raw text */
const MENTION_REGEX = /@(agent|flow|template|tool):([a-z0-9][a-z0-9-]*)/g;

/** Regex to detect URLs in text */
const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type Segment =
  | { type: 'text'; content: string }
  | { type: 'mention'; category: MentionCategory; name: string }
  | { type: 'url'; url: string };

/** Parse raw text into an ordered list of text / mention / url segments */
function parseSegments(text: string): Segment[] {
  type Token = { index: number; length: number; kind: 'mention' | 'url'; data: unknown };
  const tokens: Token[] = [];

  const mentionRe = new RegExp(MENTION_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = mentionRe.exec(text)) !== null) {
    tokens.push({
      index: m.index,
      length: m[0].length,
      kind: 'mention',
      data: { category: m[1] as MentionCategory, name: m[2] },
    });
  }

  const urlRe = new RegExp(URL_REGEX.source, 'g');
  while ((m = urlRe.exec(text)) !== null) {
    const overlaps = tokens.some(
      (t) => m!.index >= t.index && m!.index < t.index + t.length,
    );
    if (!overlaps) {
      tokens.push({ index: m.index, length: m[0].length, kind: 'url', data: { url: m[0] } });
    }
  }

  tokens.sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const token of tokens) {
    if (token.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, token.index) });
    }
    if (token.kind === 'mention') {
      const { category, name } = token.data as { category: MentionCategory; name: string };
      segments.push({ type: 'mention', category, name });
    } else {
      const { url } = token.data as { url: string };
      segments.push({ type: 'url', url });
    }
    lastIndex = token.index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers — build non-editable inline elements for contentEditable
// ---------------------------------------------------------------------------

/** Walk DOM children and extract the raw text value with @category:name tokens */
function extractRawText(el: HTMLElement): string {
  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? '').replace(/\u200B/g, '');
    } else if (node instanceof HTMLElement) {
      if (node.dataset.mentionCategory && node.dataset.mentionName) {
        text += `@${node.dataset.mentionCategory}:${node.dataset.mentionName}`;
      } else if (node.dataset.urlValue) {
        text += node.dataset.urlValue;
      } else if (node.tagName === 'BR') {
        text += '\n';
      } else if (node.tagName === 'DIV' || node.tagName === 'P') {
        // Chrome sometimes wraps lines in divs
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
        text += extractRawText(node);
      }
    }
  }
  return text;
}

/** Build a non-editable mention badge DOM element */
function buildMentionNode(
  category: MentionCategory,
  name: string,
  entities: MentionEntity[],
  iconBuilder?: (entity: MentionEntity) => HTMLElement | null,
): HTMLSpanElement {
  const entity = entities.find((e) => e.category === category && e.name === name);

  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.dataset.mentionCategory = category;
  span.dataset.mentionName = name;
  span.className =
    'inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap align-baseline cursor-default';

  // Icon — prefer custom builder, then fall back to avatar/emoji/initial
  const customIcon = entity && iconBuilder ? iconBuilder(entity) : null;
  if (customIcon) {
    span.appendChild(customIcon);
  } else {
    const px = 14;
    if (entity?.avatarUrl) {
      const img = document.createElement('img');
      img.src = entity.avatarUrl;
      img.alt = '';
      img.width = px;
      img.height = px;
      img.className = 'rounded-full object-cover shrink-0';
      img.style.cssText = `width:${px}px;height:${px}px`;
      span.appendChild(img);
    } else if (entity?.emoji) {
      const em = document.createElement('span');
      em.className = 'shrink-0 leading-none';
      em.textContent = entity.emoji;
      span.appendChild(em);
    } else {
      const initial = document.createElement('span');
      initial.className = cn(
        'shrink-0 rounded-full flex items-center justify-center text-white font-medium',
        entity?.avatarColor || 'bg-muted-foreground/50',
      );
      initial.style.cssText = `width:${px}px;height:${px}px;font-size:${Math.round(px * 0.55)}px`;
      initial.textContent = entity?.displayName?.charAt(0).toUpperCase() ?? '?';
      span.appendChild(initial);
    }
  }

  const label = document.createElement('span');
  label.textContent = entity?.displayName ?? name;
  span.appendChild(label);

  return span;
}

/** Build a non-editable URL badge DOM element */
function buildUrlNode(url: string): HTMLSpanElement {
  const domain = extractDomain(url);
  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.dataset.urlValue = url;
  span.className =
    'inline-flex items-center gap-1 bg-muted text-foreground border border-border rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap align-baseline cursor-default';

  if (domain) {
    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    img.alt = '';
    img.width = 14;
    img.height = 14;
    img.className = 'shrink-0 rounded-sm';
    span.appendChild(img);
  }

  const label = document.createElement('span');
  label.className = 'max-w-[200px] truncate';
  label.textContent = domain || url;
  span.appendChild(label);

  return span;
}

/** Render parsed segments into a contentEditable element */
function renderSegmentsToDOM(
  el: HTMLDivElement,
  segments: Segment[],
  entities: MentionEntity[],
  iconBuilder?: (entity: MentionEntity) => HTMLElement | null,
) {
  el.innerHTML = '';
  for (const seg of segments) {
    if (seg.type === 'text') {
      const lines = seg.content.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) el.appendChild(document.createElement('br'));
        if (line) el.appendChild(document.createTextNode(line));
      });
    } else if (seg.type === 'mention') {
      el.appendChild(buildMentionNode(seg.category, seg.name, entities, iconBuilder));
    } else {
      el.appendChild(buildUrlNode(seg.url));
    }
  }

  // Ensure cursor can be placed after a trailing non-editable element
  const last = el.lastChild;
  if (last && last instanceof HTMLElement && (last.dataset.mentionCategory || last.dataset.urlValue)) {
    el.appendChild(document.createTextNode('\u200B'));
  }
}

/** Default entity icon for dropdown items (React component) */
function DefaultEntityIcon({ entity, size }: { entity: MentionEntity; size: 'sm' | 'md' }) {
  const px = size === 'sm' ? 14 : 18;
  if (entity.avatarUrl) {
    return (
      <img
        src={entity.avatarUrl}
        alt=""
        width={px}
        height={px}
        className="rounded-full object-cover shrink-0"
        style={{ width: px, height: px }}
      />
    );
  }
  if (entity.emoji) {
    return <span className="shrink-0 leading-none">{entity.emoji}</span>;
  }
  const initial = entity.displayName?.charAt(0).toUpperCase() ?? '?';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full flex items-center justify-center text-white font-medium',
        entity.avatarColor || 'bg-muted-foreground/50',
      )}
      style={{ width: px, height: px, fontSize: px * 0.55 }}
    >
      {initial}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MentionTextarea = forwardRef<MentionTextareaRef, MentionTextareaProps>(
  function MentionTextarea(
    {
      value,
      onChange,
      entities,
      placeholder,
      'aria-label': ariaLabel,
      className,
      minRows = 4,
      maxHeight = 300,
      onKeyDown: externalKeyDown,
      renderEntityIcon,
      renderEntityIconDOM,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Track the last value we extracted from the DOM to avoid re-rendering
    // when the parent just echoes our own onChange back via the value prop.
    const lastExtractedValue = useRef(value);
    const hasRendered = useRef(false);
    const hasRenderedWithEntities = useRef(false);
    const isComposing = useRef(false);

    const [showDropdown, setShowDropdown] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionCategory, setMentionCategory] = useState<MentionCategory | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isEmpty, setIsEmpty] = useState(!value);

    // Track the text node and offset where the @ trigger lives
    const mentionTriggerNode = useRef<Text | null>(null);
    const mentionTriggerOffset = useRef(-1);

    useImperativeHandle(ref, () => ({
      focus: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        // Place cursor at end
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      },
      textarea: null,
    }));

    // ---- Sync DOM from value prop (initial render + external changes) ----
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const needsRender =
        !hasRendered.current ||
        value !== lastExtractedValue.current ||
        (!hasRenderedWithEntities.current && entities.length > 0);

      if (!needsRender) return;

      hasRendered.current = true;
      if (entities.length > 0) hasRenderedWithEntities.current = true;
      lastExtractedValue.current = value;

      const segments = parseSegments(value);
      renderSegmentsToDOM(editor, segments, entities, renderEntityIconDOM);
      setIsEmpty(!value);

      // Place cursor at end if editor is focused
      const sel = window.getSelection();
      if (sel && document.activeElement === editor) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, [value, entities, renderEntityIconDOM]);

    // ---- Detect @ trigger from cursor position ----
    const detectMentionTrigger = useCallback(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.focusNode) {
        setShowDropdown(false);
        return;
      }

      const focusNode = sel.focusNode;
      const focusOffset = sel.focusOffset;

      if (focusNode.nodeType !== Node.TEXT_NODE) {
        setShowDropdown(false);
        return;
      }

      const text = focusNode.textContent ?? '';
      const beforeCursor = text.slice(0, focusOffset);
      const lastAt = beforeCursor.lastIndexOf('@');

      if (lastAt === -1) {
        setShowDropdown(false);
        return;
      }

      // @ must be at start of text node or preceded by whitespace
      if (lastAt > 0 && beforeCursor[lastAt - 1] !== ' ' && beforeCursor[lastAt - 1] !== '\n') {
        setShowDropdown(false);
        return;
      }

      const afterAt = beforeCursor.slice(lastAt + 1);

      // Space or newline closes the trigger
      if (afterAt.includes(' ') || afterAt.includes('\n')) {
        setShowDropdown(false);
        return;
      }

      // Parse category prefix
      const colonIdx = afterAt.indexOf(':');
      if (colonIdx !== -1) {
        const prefix = afterAt.slice(0, colonIdx) as MentionCategory;
        if (CATEGORY_ORDER.includes(prefix)) {
          setMentionCategory(prefix);
          setMentionFilter(afterAt.slice(colonIdx + 1));
        } else {
          setShowDropdown(false);
          return;
        }
      } else {
        setMentionCategory(null);
        setMentionFilter(afterAt);
      }

      mentionTriggerNode.current = focusNode as Text;
      mentionTriggerOffset.current = lastAt;
      setShowDropdown(true);
      setSelectedIndex(0);
    }, []);

    // ---- Handle input events ----
    const syncMentionValueFromEditor = useCallback(() => {
      const editor = editorRef.current;
      if (!editor || isComposing.current) return;

      const rawText = extractRawText(editor);

      // Prevent duplicate processing when execCommand triggers onInput
      if (rawText === lastExtractedValue.current) {
        // Still detect triggers even if text didn't change (cursor may have moved)
        detectMentionTrigger();
        return;
      }

      lastExtractedValue.current = rawText;
      setIsEmpty(!rawText);
      onChange(rawText);
      detectMentionTrigger();
    }, [onChange, detectMentionTrigger]);

    // ---- Filter entities for dropdown ----
    const filteredEntities = useMemo(() => {
      if (!showDropdown) return [];
      const q = mentionFilter.toLowerCase();

      if (mentionCategory) {
        return entities
          .filter(
            (e) =>
              e.category === mentionCategory &&
              (e.displayName.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)),
          )
          .slice(0, 8);
      }

      const filtered = entities.filter(
        (e) =>
          e.displayName.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.category.includes(q),
      );

      const grouped: MentionEntity[] = [];
      for (const cat of CATEGORY_ORDER) {
        const catItems = filtered.filter((e) => e.category === cat).slice(0, 4);
        grouped.push(...catItems);
      }
      return grouped.slice(0, 10);
    }, [showDropdown, mentionFilter, mentionCategory, entities]);

    // ---- Group entities by category for rendering ----
    const groupedEntities = useMemo(() => {
      const groups: { category: MentionCategory; items: MentionEntity[] }[] = [];
      let currentCat: MentionCategory | null = null;
      let currentItems: MentionEntity[] = [];

      for (const entity of filteredEntities) {
        if (entity.category !== currentCat) {
          if (currentCat !== null && currentItems.length > 0) {
            groups.push({ category: currentCat, items: currentItems });
          }
          currentCat = entity.category;
          currentItems = [entity];
        } else {
          currentItems.push(entity);
        }
      }
      if (currentCat !== null && currentItems.length > 0) {
        groups.push({ category: currentCat, items: currentItems });
      }

      return groups;
    }, [filteredEntities]);

    // ---- Insert mention ----
    const insertMention = useCallback(
      (entity: MentionEntity) => {
        const editor = editorRef.current;
        const textNode = mentionTriggerNode.current;
        const atOffset = mentionTriggerOffset.current;

        if (!editor || !textNode || atOffset < 0 || !editor.contains(textNode)) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const cursorOffset =
          sel.focusNode === textNode
            ? sel.focusOffset
            : (textNode.textContent?.length ?? 0);

        const fullText = textNode.textContent ?? '';
        const before = fullText.slice(0, atOffset);
        const after = fullText.slice(cursorOffset);

        const parent = textNode.parentNode!;

        // Insert text before the @ trigger
        if (before) {
          parent.insertBefore(document.createTextNode(before), textNode);
        }

        // Insert the mention badge
        const mentionSpan = buildMentionNode(entity.category, entity.name, entities, renderEntityIconDOM);
        parent.insertBefore(mentionSpan, textNode);

        // Insert a space + remaining text so the cursor has somewhere to go
        const afterTextNode = document.createTextNode(' ' + after);
        parent.insertBefore(afterTextNode, textNode);

        // Remove the original text node
        parent.removeChild(textNode);

        // Position cursor right after the space
        const range = document.createRange();
        range.setStart(afterTextNode, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        // Update value
        const rawText = extractRawText(editor);
        lastExtractedValue.current = rawText;
        setIsEmpty(!rawText);
        onChange(rawText);

        // Close dropdown
        setShowDropdown(false);
        setMentionCategory(null);
        setMentionFilter('');
        setSelectedIndex(0);
        mentionTriggerNode.current = null;
        mentionTriggerOffset.current = -1;
      },
      [entities, onChange, renderEntityIconDOM],
    );

    // ---- Keyboard handling ----
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Dropdown navigation
        if (showDropdown && filteredEntities.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, filteredEntities.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertMention(filteredEntities[selectedIndex]);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setShowDropdown(false);
            return;
          }
        }

        // Normalize Enter to <br> instead of <div> (Chrome wraps in divs)
        if (
          e.key === 'Enter' &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !showDropdown
        ) {
          e.preventDefault();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement('br');
            range.insertNode(br);
            // A trailing <br> at the end of contentEditable is invisible — add
            // a second one so the cursor visually lands on the new line.
            if (!br.nextSibling || (br.nextSibling instanceof HTMLBRElement)) {
              const trailing = document.createElement('br');
              br.parentNode?.insertBefore(trailing, br.nextSibling);
            }
            range.setStartAfter(br);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          syncMentionValueFromEditor();
          return;
        }

        // Pass to external handler (e.g. Cmd+Enter to submit)
        externalKeyDown?.(e as React.KeyboardEvent<HTMLElement>);
      },
      [showDropdown, filteredEntities, selectedIndex, insertMention, externalKeyDown, syncMentionValueFromEditor],
    );

    // ---- Paste handling (strip formatting, insert plain text) ----
    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        syncMentionValueFromEditor();
      },
      [syncMentionValueFromEditor],
    );

    // ---- Re-check trigger on click (cursor may have moved) ----
    const detectMentionAfterCursorMove = useCallback(() => {
      detectMentionTrigger();
    }, [detectMentionTrigger]);

    // ---- Close dropdown on blur ----
    const closeMentionDropdownAfterBlur = useCallback(() => {
      // Small delay to allow dropdown mouseDown to fire first
      setTimeout(() => setShowDropdown(false), 150);
    }, []);

    // ---- Scroll selected dropdown item into view ----
    useEffect(() => {
      if (!showDropdown || !dropdownRef.current) return;
      const selected = dropdownRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex, showDropdown]);

    // ---- Active descendant id for accessibility ----
    const activeDescendantId = useMemo(() => {
      if (!showDropdown || filteredEntities.length === 0 || selectedIndex >= filteredEntities.length)
        return undefined;
      const entity = filteredEntities[selectedIndex];
      return `mention-option-${entity.category}-${entity.id}`;
    }, [showDropdown, filteredEntities, selectedIndex]);

    // ---- Flat index for rendering ----
    let flatIndex = 0;

    return (
      <div className="relative">
        {/* Placeholder — shown when editor is empty */}
        {isEmpty && placeholder && (
          <div
            className="absolute inset-0 pointer-events-none text-sm text-muted-foreground/50 px-3 py-2 whitespace-pre-wrap"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}

        {/* Screen reader announcement for dropdown state */}
        <div className="sr-only" aria-live="polite" role="status">
          {showDropdown && filteredEntities.length > 0
            ? `${filteredEntities.length} mention suggestions available`
            : ''}
        </div>

        {/* Mention dropdown */}
        {showDropdown && filteredEntities.length > 0 && (
          <div
            ref={dropdownRef}
            id="mention-listbox"
            role="listbox"
            aria-label="Mention suggestions"
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-10 max-h-[240px] overflow-y-auto"
          >
            {groupedEntities.map((group) => (
              <div key={group.category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                  {CATEGORY_LABELS[group.category]}
                </div>
                {group.items.map((entity) => {
                  const idx = flatIndex++;
                  const optionId = `mention-option-${entity.category}-${entity.id}`;
                  return (
                    <button
                      key={`${entity.category}:${entity.id}`}
                      id={optionId}
                      type="button"
                      role="option"
                      aria-selected={idx === selectedIndex}
                      data-selected={idx === selectedIndex}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                        idx === selectedIndex && 'bg-muted',
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent editor blur
                        insertMention(entity);
                      }}
                    >
                      {renderEntityIcon ? (
                        renderEntityIcon(entity, 'md')
                      ) : (
                        <DefaultEntityIcon entity={entity} size="md" />
                      )}
                      <span className="font-medium truncate">
                        {entity.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                        {entity.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ContentEditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncMentionValueFromEditor}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={detectMentionAfterCursorMove}
          onBlur={closeMentionDropdownAfterBlur}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
            syncMentionValueFromEditor();
          }}
          aria-label={ariaLabel}
          aria-expanded={showDropdown && filteredEntities.length > 0}
          aria-controls={
            showDropdown && filteredEntities.length > 0 ? 'mention-listbox' : undefined
          }
          aria-activedescendant={activeDescendantId}
          role="textbox"
          aria-multiline="true"
          aria-autocomplete="list"
          className={cn(
            'w-full bg-transparent text-sm outline-none overflow-y-auto px-3 py-2 whitespace-pre-wrap break-words',
            className,
          )}
          style={{ minHeight: `${minRows * 1.5 + 1}em`, maxHeight: `${maxHeight}px` }}
        />
      </div>
    );
  },
);
