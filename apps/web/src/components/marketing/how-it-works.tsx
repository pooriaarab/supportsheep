/**
 * "How it works" — three numbered steps from subdomain to the edge. A connector
 * line threads the steps together on large screens for a sense of flow.
 */

import { STEPS } from "./marketing-content";

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-y border-border bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="how-it-works-heading"
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            From Idea to Edge in Three Steps
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            No servers to provision, no deploy pipeline to babysit.
          </p>
        </div>

        <div className="relative mt-14">
          {/* Connector line behind the steps (desktop only, decorative). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          <ol className="grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.step} className="relative flex flex-col items-start">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-primary shadow-subtle">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-mono text-sm font-semibold tabular-nums text-muted-foreground"
                    >
                      {step.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-pretty text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
