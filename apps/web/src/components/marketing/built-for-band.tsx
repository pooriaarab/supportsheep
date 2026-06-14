/**
 * "Built for…" band — honest social proof. No fake logos or testimonials; just
 * the three kinds of people (and one kind of program) Supportsheep is shaped for.
 */

import { AUDIENCES } from "./marketing-content";

export function BuiltForBand() {
  return (
    <section
      aria-labelledby="built-for-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6"
    >
      <h2
        id="built-for-heading"
        className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Built for People Who Ship
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-muted-foreground">
        Whether you write for readers or for an API, Supportsheep stays out of your
        way.
      </p>

      <ul className="mt-12 grid list-none gap-6 p-0 sm:grid-cols-3">
        {AUDIENCES.map((audience) => {
          const Icon = audience.icon;
          return (
            <li
              key={audience.title}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/50 p-8 text-center"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight">
                {audience.title}
              </h3>
              <p className="text-pretty text-sm text-muted-foreground">
                {audience.description}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
