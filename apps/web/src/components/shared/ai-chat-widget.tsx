"use client";

/**
 * AI Chat Widget -- floating chat bubble (bottom-right) that opens a chat panel.
 *
 * Uses the /api/v1/ai/chat endpoint via the useAiChat hook for streaming
 * responses with Firestore persistence. Messages are loaded from the server
 * on open and grouped by thread ID.
 * On mobile (<640px), the panel expands to full screen.
 */

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { ChatPanel } from "./ai-chat-panel";

interface AiChatWidgetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AiChatWidget({
  open: controlledOpen,
  onOpenChange,
}: AiChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const { messages, isStreaming, isLoading, error, sendMessage, clearHistory } =
    useAiChat();

  if (!isOpen) {
    return (
      <ChatTrigger
        onClick={() => setIsOpen(true)}
        hasMessages={messages.length > 0}
      />
    );
  }

  return (
    <ChatPanel
      messages={messages}
      isStreaming={isStreaming}
      isLoading={isLoading}
      error={error}
      onSend={sendMessage}
      onClear={clearHistory}
      onMinimize={() => setIsOpen(false)}
      onClose={() => setIsOpen(false)}
    />
  );
}

/* ---------- Trigger Button ---------- */

function ChatTrigger({
  onClick,
  hasMessages,
}: {
  onClick: () => void;
  hasMessages: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center",
        "rounded-full bg-primary text-primary-foreground shadow-lg",
        "hover:bg-primary/90 transition-colors",
      )}
      aria-label="Open AI chat"
    >
      <MessageCircle className="size-5" />
      {hasMessages && (
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-success border-2 border-background" />
      )}
    </button>
  );
}
