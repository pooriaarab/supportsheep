"use client";

import React from "react";
import {
  type LucideIcon,
  Brain,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Megaphone,
  Rocket,
} from "lucide-react";
import type { InterviewStyle } from "@/lib/interviews/share-link-schema";
import { cn } from "@/lib/utils";

interface ShareStyleSectionProps {
  value: InterviewStyle;
  onChange: (value: InterviewStyle) => void;
}

interface StyleOption {
  id: InterviewStyle;
  title: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: StyleOption[] = [
  {
    id: "testimonial",
    title: "Testimonial",
    description: "Pulls out a strong quote + attribution.",
    icon: Megaphone,
  },
  {
    id: "eeat",
    title: "EEAT",
    description: "Expertise & authority signals for SEO.",
    icon: GraduationCap,
  },
  {
    id: "case_study",
    title: "Case study",
    description: "Problem · approach · result format.",
    icon: FlaskConical,
  },
  {
    id: "qa",
    title: "Q&A post",
    description: "Lightly edited transcript-as-post.",
    icon: HelpCircle,
  },
  {
    id: "launch",
    title: "Launch story",
    description: "Origin story · journey · outcome.",
    icon: Rocket,
  },
  {
    id: "smart",
    title: "Smart",
    description: "AI picks the right shape from the goal.",
    icon: Brain,
  },
];

export function ShareStyleSection({ value, onChange }: ShareStyleSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Interview style</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const isActive = value === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:bg-muted/50",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {option.title}
              </div>
              <div className="text-[11px] text-muted-foreground leading-normal">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
