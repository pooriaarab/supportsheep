"use client";

import { useState, type FormEvent } from "react";
import { Mail, MessageSquare, Github } from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { Footer } from "@/components/landing/footer";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Textarea } from "@repo/ui/primitives/textarea";
import { toast } from "sonner";

const contactChannels = [
  {
    title: "Email",
    description: "Send us an email and we'll respond within 24 hours.",
    value: "support@example.com",
    href: "mailto:support@example.com",
    icon: Mail,
  },
  {
    title: "Slack Community",
    description: "Join our Slack workspace for real-time help.",
    value: "Join Slack",
    href: "https://slack.example.com",
    icon: MessageSquare,
  },
  {
    title: "GitHub Issues",
    description: "Report bugs or request features on GitHub.",
    value: "Open an issue",
    href: "https://github.com/example/app/issues",
    icon: Github,
  },
];

export function ContactPageContent() {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Message sent! We'll get back to you soon.");
      (e.target as HTMLFormElement).reset();
    }, 1000);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Contact Us</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Have a question or need help? Reach out through any channel below.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Send a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="How can we help?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Tell us more..."
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            {contactChannels.map((channel) => (
              <Card key={channel.title} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <channel.icon className="size-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {channel.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                      {channel.description}
                    </p>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {channel.value}
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
