"use client";

import { AiChatWidget } from "@/components/shared/ai-chat-widget";

export function SupportChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AiChatWidget />
    </div>
  );
}
