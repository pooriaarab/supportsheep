"use client";

/**
 * AI Chat conversation detail view for the settings page.
 *
 * Renders a full thread of messages with user/assistant bubbles,
 * timestamps, markdown, and conversation metadata.
 */

import { Bot, User, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { cn } from "@repo/ui/utils";
import { ChatMarkdown } from "@/components/shared/chat-markdown";

/* ---------- Types ---------- */

export interface DetailMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ChatThreadDetail {
  id: string;
  preview: string;
  messageCount: number;
  lastActive: string;
  status: "active" | "ended";
  messages: DetailMessage[];
}

/* ---------- Component ---------- */

interface AiChatDetailProps {
  thread: ChatThreadDetail;
  onDelete: (threadId: string) => void;
}

export function AiChatDetail({ thread, onDelete }: AiChatDetailProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 space-y-4">
        {thread.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Started</dt>
            <dd className="text-foreground font-medium">
              {formatTimestamp(thread.messages[0]?.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total messages</dt>
            <dd className="text-foreground font-medium tabular-nums">
              {thread.messages.length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-foreground font-medium capitalize">
              {thread.status}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last active</dt>
            <dd className="text-foreground font-medium">
              {formatTimestamp(new Date(thread.lastActive).getTime())}
            </dd>
          </div>
        </dl>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => onDelete(thread.id)}
        >
          <Trash2 className="size-3.5 mr-1.5" />
          Delete conversation
        </Button>
      </div>
    </div>
  );
}

/* ---------- Message Bubble ---------- */

function MessageBubble({ message }: { message: DetailMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="size-3.5 text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">
              {message.content}
            </span>
          ) : (
            <ChatMarkdown content={message.content} />
          )}
        </div>
        <span
          className={cn(
            "text-[10px] text-muted-foreground/60 px-1",
            isUser ? "text-right" : "text-left",
          )}
        >
          {formatTime(message.createdAt)}
        </span>
      </div>
      {isUser && (
        <div className="shrink-0 size-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <User className="size-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

function formatTime(ts: number): string {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isToday) return time;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "Unknown";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
