/**
 * The six-feature grid. Cards lift on hover and the icon tile warms toward the
 * brand accent — small, tasteful feedback rather than a flat icon wall.
 */

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/primitives/card";

import { FEATURES } from "./marketing-content";

export function FeatureGrid() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="features-heading"
          className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Everything You Need to Publish
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground">
          The essentials of a modern blog, without the plugin sprawl.
        </p>
      </div>

      <ul className="mt-12 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <Card className="group h-full gap-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-floating motion-reduce:transform-none motion-reduce:transition-none">
                <CardHeader>
                  <span className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-pretty">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
