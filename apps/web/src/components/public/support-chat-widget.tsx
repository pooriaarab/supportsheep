"use client";

import { MessageCircle } from "lucide-react";

export function SupportChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-secondary text-secondary-foreground rounded-full shadow-lg cursor-pointer hover:bg-secondary/90 transition-colors z-50 flex items-center gap-2 border border-border">
      <MessageCircle className="w-5 h-5" /> <span className="font-medium">Support Chat</span>
    </div>
  );
}