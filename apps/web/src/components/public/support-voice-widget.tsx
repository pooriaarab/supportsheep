"use client";

import { Mic } from "lucide-react";

export function SupportVoiceWidget() {
  return (
    <div className="fixed bottom-4 left-4 p-4 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:bg-primary/90 transition-colors z-50 flex items-center gap-2">
      <Mic className="w-5 h-5" /> <span className="font-medium">Live Voice</span>
    </div>
  );
}