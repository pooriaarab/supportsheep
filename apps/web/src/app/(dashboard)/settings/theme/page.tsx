"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Label } from "@repo/ui/primitives/label";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { FontSettings } from "@/components/settings/font-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { ArrowRight } from "lucide-react";
import { useMountEffect } from "@/hooks/use-mount-effect";

export default function ThemeSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useMountEffect(() => setMounted(true));

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Theme" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Theme
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Manage dashboard styling and public theme sections from one place.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/settings/theme/public-shell"
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-medium text-foreground">
                      Public Shell
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Header and footer logos, text fallbacks, colors, layout,
                      and banner settings.
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link
                href="/settings/theme/article"
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-medium text-foreground">
                      Article Styles
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Card radius, shadows, reading width, TOC behavior, and
                      typography for article and listing surfaces.
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Dashboard Theme
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Color theme and typography for the admin dashboard
              </p>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-foreground/80">
                    Color Mode
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose light, dark, or match your system
                  </p>
                </div>
                <Select value={mounted ? theme : "system"} onValueChange={setTheme}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FontSettings />
              <ThemeSettings />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
