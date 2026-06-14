"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { cn } from "../utils";

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  expandedWidth?: string;
}

function ExpandedInput({
  value,
  onChange,
  placeholder,
  expandedWidth,
  inputRef,
  onCollapse,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  expandedWidth: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCollapse: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative animate-in slide-in-from-right-4 fade-in-0 duration-300",
        expandedWidth,
      )}
    >
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 transform text-muted-foreground pointer-events-none z-10" aria-hidden="true" />
      <Input
        ref={inputRef}
        className="h-9 pl-9 pr-3 text-base border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) onCollapse();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            onCollapse();
          }
        }}
      />
    </div>
  );
}

export function ExpandableSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
  expandedWidth = "w-64",
}: ExpandableSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex items-center", className)}>
      {expanded ? (
        <ExpandedInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          expandedWidth={expandedWidth}
          inputRef={inputRef}
          onCollapse={() => setExpanded(false)}
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 300);
              }}
              className="size-9 p-0 text-muted-foreground hover:text-muted-foreground"
              aria-label="Search"
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Search</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
