"use client";

/**
 * AI Chat Tab -- writing assistant chat panel embedded in the editor right sidebar.
 *
 * Uses the existing useAiChat hook for streaming chat with the AI API.
 * Provides writing-specific suggestions and a compact chat UI that fits
 * within the sidebar tab layout.
 */

import { useState, useRef, useCallback, type ReactNode } from "react";
import { useAiChat, type ChatMessage } from "@/hooks/use-ai-chat";
import { Button } from "@repo/ui/primitives/button";
import { cn } from "@/lib/utils";
import { Send, Loader2, Bot, User, Trash2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                 */
/* -------------------------------------------------------------------------- */

const WRITING_SUGGESTIONS = [
  "Improve my intro paragraph",
  "Suggest a better headline",
  "Check grammar and tone",
  "Add a conclusion section",
];

function uniqueContentKey(
  prefix: string,
  content: string,
  counts: Map<string, number>,
): string {
  const base = `${prefix}:${content}`;
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}:${count}`;
}

/* -------------------------------------------------------------------------- */
/* Inline Markdown Renderer                                                    */
/* -------------------------------------------------------------------------- */

function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const keyCounts = new Map<string, number>();
  let remaining = text;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    let earliestMatch: {
      index: number;
      length: number;
      type: "bold" | "code";
      inner: string;
    } | null = null;

    if (boldMatch?.index !== undefined) {
      earliestMatch = {
        index: boldMatch.index,
        length: boldMatch[0].length,
        type: "bold",
        inner: boldMatch[1],
      };
    }

    if (codeMatch?.index !== undefined) {
      if (!earliestMatch || codeMatch.index < earliestMatch.index) {
        earliestMatch = {
          index: codeMatch.index,
          length: codeMatch[0].length,
          type: "code",
          inner: codeMatch[1],
        };
      }
    }

    if (!earliestMatch) {
      parts.push(remaining);
      break;
    }

    if (earliestMatch.index > 0) {
      parts.push(remaining.slice(0, earliestMatch.index));
    }

    if (earliestMatch.type === "bold") {
      parts.push(
        <strong key={uniqueContentKey("bold", earliestMatch.inner, keyCounts)}>
          {earliestMatch.inner}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={uniqueContentKey("code", earliestMatch.inner, keyCounts)}
          className="bg-background/50 border border-border rounded px-1 py-0.5 text-[10px] font-mono"
        >
          {earliestMatch.inner}
        </code>,
      );
    }

    remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
  }

  return parts;
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text)}</>;
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  const keyCounts = new Map<string, number>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre
          key={uniqueContentKey("code", codeLines.join("\n"), keyCounts)}
          className="bg-background/50 border border-border rounded px-2 py-1.5 text-[10px] overflow-x-auto font-mono"
        >
          {codeLines.join("\n")}
        </pre>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(
      <p
        key={uniqueContentKey("paragraph", line, keyCounts)}
        className="whitespace-pre-wrap break-words"
      >
        <InlineMarkdown text={line} />
      </p>,
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

/* -------------------------------------------------------------------------- */
/* Message Bubble                                                              */
/* -------------------------------------------------------------------------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-1.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="shrink-0 size-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="size-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed max-w-[85%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.content ? (
          isUser ? (
            <span className="whitespace-pre-wrap break-words">
              {message.content}
            </span>
          ) : (
            <SimpleMarkdown content={message.content} />
          )
        ) : (
          <span className="text-muted-foreground italic">...</span>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 size-5 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <User className="size-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Typing Indicator                                                            */
/* -------------------------------------------------------------------------- */

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 justify-start">
      <div className="shrink-0 size-5 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="size-3 text-primary" />
      </div>
      <div className="bg-muted rounded-lg px-2.5 py-1.5 flex items-center gap-1">
        <span className="size-1 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:0ms]" />
        <span className="size-1 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:150ms]" />
        <span className="size-1 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function AiChatTab() {
  const { messages, isStreaming, isLoading, error, sendMessage, clearHistory } =
    useAiChat();
  const [value, setValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const listRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) scrollToBottom();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length, isStreaming],
  );

  const handleSend = useCallback(() => {
    if (!value.trim() || isStreaming) return;
    sendMessage(value);
    setValue("");
    inputRef.current?.focus();
  }, [value, isStreaming, sendMessage]);

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-[10px] text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5 gap-1"
            onClick={clearHistory}
          >
            <Trash2 className="size-3" />
            Clear
          </Button>
        </div>
      )}

      {/* Message area */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="text-center space-y-1.5">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="size-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Writing Assistant
              </p>
              <p className="text-[10px] text-muted-foreground">
                Ask for help with your article
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-[240px]">
              {WRITING_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestion(suggestion)}
                  className={cn(
                    "px-2 py-1 rounded-full border border-border bg-muted/50 text-[10px] text-foreground",
                    "hover:bg-muted transition-colors cursor-pointer",
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming &&
              messages[messages.length - 1]?.role === "assistant" &&
              messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-error-subtle border-t border-border">
          <p className="text-[10px] text-error">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border p-2.5">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your article..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-1.5",
              "text-xs placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "max-h-20",
            )}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="size-7 shrink-0"
            onClick={handleSend}
            disabled={!value.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
