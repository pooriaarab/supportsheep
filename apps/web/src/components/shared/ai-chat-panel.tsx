"use client";

/**
 * AI Chat Panel internals -- header, message list, input, and sub-components.
 *
 * Features:
 * - Welcome greeting with suggested starter messages
 * - Markdown rendering for AI responses (bold, code, lists)
 * - Message timestamps
 * - App logo in the header
 * - Loading state for initial message fetch
 */

import { useState, useRef, useCallback, type ReactNode } from "react";
import { X, Minus, Send, Trash2, Loader2, Bot, User } from "lucide-react";
import Image from "next/image";
import { Button } from "@repo/ui/primitives/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-ai-chat";
import { useMediaQuery } from "@/hooks/use-media-query";

/* ---------- Chat Panel ---------- */

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  onSend: (content: string) => void;
  onClear: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  isLoading,
  error,
  onSend,
  onClear,
  onMinimize,
  onClose,
}: ChatPanelProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col bg-background border border-border shadow-2xl overflow-hidden",
        isMobile
          ? "inset-0"
          : "bottom-6 right-6 w-[400px] h-[500px] rounded-xl",
      )}
    >
      <PanelHeader
        onMinimize={onMinimize}
        onClose={onClose}
        onClear={onClear}
        hasMessages={messages.length > 0}
      />
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <WelcomeScreen onSend={onSend} />
      ) : (
        <MessageList messages={messages} isStreaming={isStreaming} />
      )}
      {error && (
        <div className="px-4 py-2 bg-error-subtle border-t border-border">
          <p className="text-xs text-error">{error}</p>
        </div>
      )}
      <ChatInput onSend={onSend} isStreaming={isStreaming} />
    </div>
  );
}

/* ---------- Header ---------- */

function PanelHeader({
  onMinimize,
  onClose,
  onClear,
  hasMessages,
}: {
  onMinimize: () => void;
  onClose: () => void;
  onClear: () => void;
  hasMessages: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
      <div className="flex items-center gap-2">
        <Image
          src="/logo.svg"
          alt="Logo"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span className="text-sm font-medium text-foreground">
          AI Assistant
        </span>
      </div>
      <div className="flex items-center gap-1">
        {hasMessages && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClear}
            title="Clear history"
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMinimize}
          title="Minimize"
        >
          <Minus className="size-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          title="Close"
        >
          <X className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Welcome Screen ---------- */

const SUGGESTIONS = [
  "How do I get started?",
  "Tell me about the API",
  "Help with integrations",
  "What features are available?",
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

function WelcomeScreen({ onSend }: { onSend: (content: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
      <div className="text-center space-y-2">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Bot className="size-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Hi! I&apos;m your AI assistant.
        </p>
        <p className="text-xs text-muted-foreground">
          How can I help you today?
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSend(suggestion)}
            className={cn(
              "px-3 py-1.5 rounded-full border border-border bg-muted/50 text-xs text-foreground",
              "hover:bg-muted transition-colors cursor-pointer",
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Message List ---------- */

function MessageList({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLast={msg === messages[messages.length - 1]}
          isStreaming={isStreaming}
        />
      ))}
      {isStreaming &&
        messages[messages.length - 1]?.role === "assistant" &&
        messages[messages.length - 1]?.content === "" && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

/* ---------- Message Bubble ---------- */

function MessageBubble({
  message,
  isLast,
  isStreaming,
}: {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="size-3.5 text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
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
              <MarkdownContent content={message.content} />
            )
          ) : isLast && isStreaming ? null : (
            <span className="text-muted-foreground italic">Empty response</span>
          )}
        </div>
        <MessageTimestamp createdAt={message.createdAt} isUser={isUser} />
      </div>
      {isUser && (
        <div className="shrink-0 size-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <User className="size-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/* ---------- Message Timestamp ---------- */

function MessageTimestamp({
  createdAt,
  isUser,
}: {
  createdAt: number;
  isUser: boolean;
}) {
  if (!createdAt) return null;

  const date = new Date(createdAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const display = isToday
    ? timeStr
    : `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;

  return (
    <span
      className={cn(
        "text-[10px] text-muted-foreground/60 px-1",
        isUser ? "text-right" : "text-left",
      )}
    >
      {display}
    </span>
  );
}

/* ---------- Markdown Content ---------- */

function MarkdownContent({ content }: { content: string }) {
  const elements = parseMarkdown(content);
  return <div className="space-y-1.5">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text)}</>;
}

function parseMarkdown(text: string): ReactNode[] {
  const lines = text.split("\n");
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
          className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs overflow-x-auto font-mono"
        >
          {codeLines.join("\n")}
        </pre>,
      );
      continue;
    }

    if (line.match(/^#{1,3}\s/)) {
      elements.push(
        <p
          key={uniqueContentKey("heading", line, keyCounts)}
          className="font-semibold"
        >
          <InlineMarkdown text={line.replace(/^#{1,3}\s+/, "")} />
        </p>,
      );
      i++;
      continue;
    }

    if (line.match(/^\s*[-*]\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul
          key={uniqueContentKey("unordered", listItems.join("\n"), keyCounts)}
          className="list-disc list-inside space-y-0.5"
        >
          {listItems.map((item) => (
            <li key={uniqueContentKey("item", item, keyCounts)}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.match(/^\s*\d+\.\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol
          key={uniqueContentKey("ordered", listItems.join("\n"), keyCounts)}
          className="list-decimal list-inside space-y-0.5"
        >
          {listItems.map((item) => (
            <li key={uniqueContentKey("item", item, keyCounts)}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ol>,
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

  return elements;
}

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
          className="bg-background/50 border border-border rounded px-1 py-0.5 text-xs font-mono"
        >
          {earliestMatch.inner}
        </code>,
      );
    }

    remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
  }

  return parts;
}

/* ---------- Typing Indicator ---------- */

function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start">
      <div className="shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="size-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:0ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/* ---------- Chat Input ---------- */

function ChatInput({
  onSend,
  isStreaming,
}: {
  onSend: (content: string) => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!value.trim() || isStreaming) return;
    onSend(value);
    setValue("");
    inputRef.current?.focus();
  }, [value, isStreaming, onSend]);

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-end gap-2">
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
          placeholder="Type a message..."
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "max-h-24",
          )}
          disabled={isStreaming}
        />
        <Button
          size="icon"
          className="size-9 shrink-0"
          onClick={handleSend}
          disabled={!value.trim() || isStreaming}
        >
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
