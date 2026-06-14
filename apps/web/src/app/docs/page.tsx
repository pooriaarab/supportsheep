import {
  BookOpen,
  Code,
  Layers,
  Map,
} from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { Footer } from "@/components/landing/footer";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";

export const metadata = {
  title: "Documentation",
  description:
    "Everything you need to build with the platform.",
};

const sections = [
  {
    title: "Getting Started",
    description:
      "Learn how to set up the project, configure your environment, and deploy your first app.",
    icon: BookOpen,
  },
  {
    title: "API Reference",
    description:
      "Complete reference for all API endpoints including authentication, items, users, and tasks.",
    icon: Code,
  },
  {
    title: "Components",
    description:
      "Browse the full UI component library with usage examples, props, and design guidelines.",
    icon: Layers,
  },
  {
    title: "Guides",
    description:
      "Step-by-step tutorials for common workflows like adding integrations, custom themes, and more.",
    icon: Map,
  },
];

const tocItems = sections.map((s) => ({
  label: s.title,
  id: s.title.toLowerCase().replace(/\s+/g, "-"),
}));

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="flex gap-8">
          <nav className="hidden lg:block w-48 shrink-0 sticky top-24 self-start">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              On this page
            </h3>
            <ul className="space-y-1">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground">
                Documentation
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Everything you need to build with the platform.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {sections.map((section) => (
                <Card
                  key={section.title}
                  id={section.title.toLowerCase().replace(/\s+/g, "-")}
                  className="p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <section.icon className="size-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-sm font-semibold text-foreground">
                          {section.title}
                        </h2>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Coming soon
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
