"use client";

import React, { useState, useRef } from "react";
import { Button } from "@repo/ui/primitives/button";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";
import { Loader2, Copy, Check, Sparkles, RefreshCw, MessageSquare, Edit2 } from "lucide-react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createLogger } from "@/lib/logger";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/primitives/tabs";
import { Input } from "@repo/ui/primitives/input";
import { Textarea } from "@repo/ui/primitives/textarea";
import { applyDiff, type CanvasState } from "@/hooks/use-interview-session";

const log = createLogger("interviews:live-watch");

interface Suggestion {
  text: string;
  rationale: string;
}

interface Event {
  id: string;
  kind: string;
  payload: unknown;
  ts: string;
}

interface LiveWatchClientProps {
  interview: {
    id: string;
    topic: string;
    style: string;
    status: string;
  };
}

export function LiveWatchClient({ interview }: LiveWatchClientProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // V2.5 Canvas Tracking States
  const [canvas, setCanvas] = useState<CanvasState>({
    title: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  });
  const [editingKey, setEditingKey] = useState<{
    sectionId: string;
    field: "heading" | "paragraph_text" | "bullet_text";
    index?: number;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const lastTsRef = useRef("");
  const isPollingRef = useRef(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // SSE canvas tracking listener. The interview token cookie is set by
  // the server component (see ../page.tsx) so EventSource picks it up
  // automatically as a same-origin cookie — no explicit priming call.
  useMountEffect(() => {
    const streamUrl = `/api/v1/interviews/${interview.id}/stream`;
    const evs = new EventSource(streamUrl);

    evs.addEventListener("writer_diff", (ev) => {
      try {
        const diff = JSON.parse((ev as MessageEvent).data);
        log.debug("Received writer_diff SSE message", diff);
        applyDiff(setCanvas, diff);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err });
      }
    });

    evs.addEventListener("canvas_edit", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        log.debug("Received canvas_edit SSE message", data);
        applyDiff(setCanvas, { type: "human_edit_applied", payload: data });
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err });
      }
    });

    evs.onerror = (err) => {
      log.error("SSE Connection error in LiveWatchClient", { error: err });
    };

    return () => {
      evs.close();
    };
  });

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    const { sectionId, field, index } = editingKey;

    // 1. Optimistic update
    const previousCanvas = JSON.parse(JSON.stringify(canvas));
    applyDiff(setCanvas, {
      type: "human_edit_applied",
      payload: { sectionId, field, index, value: editValue },
    });
    setEditingKey(null);
    const valueToSave = editValue;
    setEditValue("");

    try {
      // 2. Submit to canvas-edit API
      const res = await fetch(`/api/v1/interviews/${interview.id}/canvas-edit`, {
        method: "Article",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sectionId, field, index, value: valueToSave }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save canvas edit");
      }
    } catch (err: unknown) {
      log.error("Failed to submit canvas edit", { error: err });
      const errMsg = err instanceof Error ? err.message : "Failed to save canvas edit. Reverting.";
      setError(errMsg);
      // 3. Revert on failure
      setCanvas(previousCanvas);
    }
  };

  // Poll for events using useMountEffect
  useMountEffect(() => {
    let active = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchEvents = async () => {
      if (!active) return;
      if (isPollingRef.current) {
        try {
          const currentLastTs = lastTsRef.current;
          const url = `/api/v1/interviews/${interview.id}/events?limit=100${
            currentLastTs ? `&since=${encodeURIComponent(currentLastTs)}` : ""
          }`;
          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as { events: Event[] };
            if (active && data.events && data.events.length > 0) {
              setEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.id));
                const filtered = data.events.filter((e) => !existingIds.has(e.id));
                return [...prev, ...filtered];
              });

              const latestTs = data.events.reduce(
                (max, e) => (e.ts > max ? e.ts : max),
                currentLastTs
              );
              lastTsRef.current = latestTs;

              // Scroll to bottom after state update
              setTimeout(() => {
                transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }
          }
        } catch (err) {
          log.error("Error polling events", { error: err });
        }
      }
      timeoutId = setTimeout(fetchEvents, 3000);
    };

    void fetchEvents();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  const handleSuggest = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/interviews/${interview.id}/follow-ups`, {
        method: "Article",
      });

      if (res.status === 429) {
        setError("Rate limited: You can only generate suggestions once every 30 seconds.");
        return;
      }

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string; message?: string };
        throw new Error(errData.message || errData.error || "Failed to generate suggestions");
      }

      const data = (await res.json()) as { suggestions: Suggestion[] };
      setSuggestions(data.suggestions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      log.error("Failed to copy text", { error: err });
    }
  };

  const transcriptEvents = events.filter(
    (e) => e.kind === "transcript_user" || e.kind === "transcript_ai"
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transcript & Canvas Column */}
      <Card className="lg:col-span-2 p-6 flex flex-col h-[600px] border">
        <Tabs defaultValue="transcript" className="flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <TabsList className="grid grid-cols-2 h-10 w-[240px]">
              <TabsTrigger value="transcript" className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="canvas" className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Live Canvas
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Badge variant={interview.status === "live" ? "default" : "secondary"}>
                {interview.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newVal = !isPolling;
                  setIsPolling(newVal);
                  isPollingRef.current = newVal;
                }}
                className="h-8 px-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPolling ? "animate-spin" : ""}`} />
                <span className="sr-only">Toggle polling</span>
              </Button>
            </div>
          </div>

          <TabsContent value="transcript" className="flex-1 flex flex-col min-h-0">
            {/* Scrollable transcript area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {transcriptEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Waiting for live conversation events...</p>
                </div>
              ) : (
                transcriptEvents.map((e) => {
                  const isUser = e.kind === "transcript_user";
                  const text = (e.payload as { text?: string })?.text || "";
                  return (
                    <div
                      key={e.id}
                      className={`flex flex-col max-w-[85%] ${
                        isUser ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <span className="text-xs text-muted-foreground mb-1 font-medium">
                        {isUser ? "Guest" : "Interviewer"}
                      </span>
                      <div
                        className={`rounded-lg px-4 py-2.5 text-sm ${
                          isUser
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-muted text-foreground rounded-tl-none"
                        }`}
                      >
                        {text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={transcriptEndRef} />
            </div>
          </TabsContent>

          <TabsContent value="canvas" className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-6 pr-2">
            {canvas.sections.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Waiting for live canvas sections to generate...</p>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {canvas.title && (
                  <div className="pb-4 border-b">
                    <h1 className="text-xl font-bold text-foreground">{canvas.title}</h1>
                  </div>
                )}

                {canvas.sections.map((section) => (
                  <div key={section.id} className="p-4 rounded-lg border bg-accent/5 space-y-4 relative">
                    {/* Heading */}
                    <div className="group flex items-start justify-between">
                      {editingKey?.sectionId === section.id && editingKey?.field === "heading" ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="font-semibold text-lg flex-1"
                          />
                          <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between">
                          <h3 className="font-semibold text-lg text-foreground">
                            {section.heading || <span className="text-muted-foreground italic">Untitled Section</span>}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingKey({ sectionId: section.id, field: "heading" });
                              setEditValue(section.heading || "");
                            }}
                            className="opacity-0 group-hover:opacity-100 h-8 px-2 transition-opacity flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Paragraphs */}
                    <div className="space-y-3">
                      {section.paragraphs.map((p, idx) => (
                        <div key={`${section.id}-p-${idx}`} className="group flex items-start justify-between gap-4">
                          {editingKey?.sectionId === section.id && editingKey?.field === "paragraph_text" && editingKey?.index === idx ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="text-sm leading-relaxed flex-1 min-h-[100px]"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-start justify-between gap-4">
                              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                                {p}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingKey({ sectionId: section.id, field: "paragraph_text", index: idx });
                                  setEditValue(p);
                                }}
                                className="opacity-0 group-hover:opacity-100 h-8 px-2 shrink-0 transition-opacity flex items-center gap-1"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Bullets */}
                    {section.bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-2">
                        {section.bullets.map((b, idx) => (
                          <li key={`${section.id}-b-${idx}`} className="group text-sm text-muted-foreground">
                            {editingKey?.sectionId === section.id && editingKey?.field === "bullet_text" && editingKey?.index === idx ? (
                              <div className="flex-1 flex items-center gap-2 mt-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="text-sm flex-1"
                                />
                                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex-1 flex items-center justify-between gap-4">
                                <span>{b}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingKey({ sectionId: section.id, field: "bullet_text", index: idx });
                                    setEditValue(b);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 h-8 px-2 transition-opacity flex items-center gap-1"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Edit
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Sidebar Suggestions Column */}
      <div className="space-y-6">
        <Card className="p-6 border flex flex-col h-[600px]">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Claude Suggestions</h2>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Get instant follow-up questions tailored to the interview topic (
            <span className="font-semibold">{interview.topic}</span>) and current transcript context.
          </p>

          <Button
            onClick={handleSuggest}
            disabled={isSuggesting || transcriptEvents.length === 0}
            className="w-full gap-2 mb-4 font-medium"
          >
            {isSuggesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Suggest follow-ups
              </>
            )}
          </Button>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive mb-4 border border-destructive/20">
              {error}
            </div>
          )}

          {/* Scrollable suggestions area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {suggestions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <Sparkles className="h-10 w-10 text-primary mb-2" />
                <p className="text-xs">No suggestions generated yet.</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Wait for conversation content and click &quot;Suggest follow-ups&quot; to consult Claude.
                </p>
              </div>
            ) : (
              suggestions.map((suggestion, index) => (
                <div
                  key={`${index}-${suggestion.text}`}
                  className="rounded-lg border bg-card p-4 space-y-3 transition-colors hover:bg-accent/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      &ldquo;{suggestion.text}&rdquo;
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(suggestion.text, index)}
                      className="h-8 w-8 p-0 shrink-0"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      )}
                    </Button>
                  </div>
                  {suggestion.rationale && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-primary mr-1">
                          Rationale:
                        </span>
                        {suggestion.rationale}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
