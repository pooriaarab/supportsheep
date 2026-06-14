/**
 * FAQ section.
 *
 * Built on native `<details>/<summary>` so it is fully server-rendered and
 * keyboard-operable for free (Enter/Space toggles, the disclosure triangle is
 * exposed to assistive tech) — no client JS and no extra dependency, since the
 * design system ships no Accordion primitive. The chevron rotation is the only
 * motion, and it is CSS-gated for reduced-motion users.
 */

import { ChevronDown } from "lucide-react";

import { FAQS } from "./marketing-content";

export function MarketingFaq() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="border-t border-border bg-muted/30"
    >
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="faq-heading"
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Everything you might want to know before you claim a subdomain.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-border bg-card/50 transition-colors duration-200 hover:border-primary/40 open:border-primary/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-left font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <span className="text-pretty">{faq.question}</span>
                <ChevronDown
                  className="mkt-faq-chevron size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </summary>
              <p className="text-pretty px-5 pb-5 text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
