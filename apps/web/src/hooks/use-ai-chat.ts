"use client";

/**
 * Hook for managing AI chat conversations with Firestore persistence
 * and streaming responses.
 *
 * Messages are persisted to Firestore via the /api/v1/ai/chat endpoint.
 * A thread/conversation ID groups messages together. On mount, existing
 * messages are loaded from the server.
 */

import { useState, useCallback, useRef } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface UseAiChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  threadId: string;
  sendMessage: (content: string) => void;
  clearHistory: () => void;
  cancel: () => void;
}

const THREAD_KEY = "ai-chat-thread-id";

function getOrCreateThreadId(): string {
  if (typeof window === "undefined") return createId();
  const existing = localStorage.getItem(THREAD_KEY);
  if (existing) return existing;
  const id = createId();
  localStorage.setItem(THREAD_KEY, id);
  return id;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAiChat(): UseAiChatResult {
  const [threadId] = useState(getOrCreateThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useMountEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(
          `/api/v1/ai/chat?threadId=${encodeURIComponent(threadId)}`,
        );
        if (!res.ok) {
          if (res.status !== 404) {
            setError("Failed to load message history");
          }
          return;
        }
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setMessages(
            json.data.map(
              (m: { id: string; role: string; content: string; createdAt: number }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                createdAt: m.createdAt,
              }),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load message history");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  });

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isStreaming) return;

      cancel();
      setError(null);

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        content: content.trim(),
        createdAt: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/v1/ai/chat", {
            method: "Article",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              content: content.trim(),
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorBody = await response
              .json()
              .catch(() => ({ error: "Request failed" }));
            setError(errorBody.error ?? `HTTP ${response.status}`);
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
            return;
          }

          if (!response.body) {
            setError("No response body");
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();

                if (data === "[DONE]") return;

                try {
                  const parsed = JSON.parse(data) as {
                    type?: string;
                    content?: string;
                    error?: string;
                  };
                  if (parsed.error) {
                    setError(parsed.error);
                    return;
                  }
                  if (parsed.content) {
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === "assistant") {
                        next[next.length - 1] = {
                          ...last,
                          content: last.content + parsed.content,
                        };
                      }
                      return next;
                    });
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Chat failed");
        } finally {
          setIsStreaming(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      })();
    },
    [isStreaming, cancel, threadId],
  );

  const clearHistory = useCallback(() => {
    cancel();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    localStorage.removeItem(THREAD_KEY);
    window.location.reload();
  }, [cancel]);

  return {
    messages,
    isStreaming,
    isLoading,
    error,
    threadId,
    sendMessage,
    clearHistory,
    cancel,
  };
}
