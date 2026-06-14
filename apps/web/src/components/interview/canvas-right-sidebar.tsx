"use client";

/**
 * Canvas Right Sidebar — SEO / Image / EEAT tabs surfaced alongside the
 * body editor. Mirrors the layout of the post editor (`EditorLayout`)
 * sidebar at `/[postId]/edit`: a `Tabs` header with icon+label triggers
 * sitting above scrollable tab content in a fixed-width column.
 *
 * Each tab is a thin wrapper around the existing canvas-aware tab body
 * components (`SeoTab`, `ImageTab`, `ReadyTab`). The body lives in the
 * main column now — see `CanvasCollaborativeEditor` — so this sidebar
 * exists purely for derived signals (SEO score, featured image, EEAT
 * checklist) the author wants to monitor while writing.
 */

import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/ui/primitives/tabs";
import { BarChart3, ImageIcon, ShieldCheck } from "lucide-react";
import { SeoTab } from "./canvas-tabs/seo-tab";
import { ImageTab } from "./canvas-tabs/image-tab";
import { ReadyTab } from "./canvas-tabs/ready-tab";
import type { CanvasState } from "@/hooks/use-interview-session";

type RightTab = "seo" | "image" | "eeat";

interface Props {
  canvas: CanvasState;
  guestName?: string;
  className?: string;
}

export function CanvasRightSidebar({ canvas, guestName, className }: Props) {
  const [activeTab, setActiveTab] = useState<RightTab>("seo");

  return (
    <div
      data-testid="canvas-right-sidebar"
      className={`w-80 border-l border-border bg-background flex-shrink-0 flex flex-col overflow-hidden ${className ?? ""}`}
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as RightTab)}
      >
        <TabsList className="w-full justify-start rounded-none border-b border-border h-9 bg-transparent px-1">
          <TabsTrigger
            value="seo"
            className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
          >
            <BarChart3 className="size-3" />
            SEO
          </TabsTrigger>
          <TabsTrigger
            value="image"
            className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
          >
            <ImageIcon className="size-3" />
            Image
          </TabsTrigger>
          <TabsTrigger
            value="eeat"
            className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
          >
            <ShieldCheck className="size-3" />
            EEAT
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "seo" && <SeoTab canvas={canvas} />}
        {activeTab === "image" && <ImageTab canvas={canvas} />}
        {activeTab === "eeat" && (
          <ReadyTab canvas={canvas} guestName={guestName} />
        )}
      </div>
    </div>
  );
}
