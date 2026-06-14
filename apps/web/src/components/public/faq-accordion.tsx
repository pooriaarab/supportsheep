"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqAccordionItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqAccordionItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="border-t border-border">
      {items.map((item, index) => (
        <div
          key={item.question}
          className="border-b border-border last:border-b-0"
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="group flex w-full items-center justify-between gap-4 py-5 text-left"
            aria-expanded={openIndex === index}
          >
            <span className="text-sm font-medium text-foreground transition-colors group-hover:text-foreground/80 sm:text-base">
              {item.question}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                openIndex === index ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{
              gridTemplateRows: openIndex === index ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
