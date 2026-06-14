"use client";

import React from "react";
import type { InterviewLanguage } from "@/lib/interviews/share-link-schema";
import { LANGUAGE_NAMES } from "@/lib/interviews/share-link-schema";
import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";

interface ShareLanguageSectionProps {
  value: InterviewLanguage;
  onChange: (value: InterviewLanguage) => void;
}

export function ShareLanguageSection({ value, onChange }: ShareLanguageSectionProps) {
  const options = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    id: code as InterviewLanguage,
    name,
  }));

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="share-language" className="text-sm font-semibold text-foreground">
        Interview language
      </Label>
      <Select value={value} onValueChange={(val) => onChange(val as InterviewLanguage)}>
        <SelectTrigger id="share-language" className="w-full">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
