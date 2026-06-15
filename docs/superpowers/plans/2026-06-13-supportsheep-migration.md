# Supportsheep Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the `supportsheep` multitenant infrastructure to `supportsheep`, rebrand the platform, overhaul the marketing landing page to match Ferndesk's value prop, and add Support-specific AI Voice and Chatbot widget placeholders.

**Architecture:** Clone `pooriaarab/supportsheep` as the foundation. We will store tenant support configurations (like enabling Voice/Chat and API keys) inside the existing `BlogConfig` JSON schema in Drizzle. The tenant's public view will inject Voice and Chat widgets if enabled. The marketing root will be overhauled.

**Tech Stack:** Next.js (App Router), React, TailwindCSS, Drizzle ORM, Cloudflare Pages.

---

### Task 1: Project Initialization

**Files:**
- Modify: `.git` (Re-initialize)

- [ ] **Step 1: Clone the foundation repository**
```bash
# Assuming you are in /Users/parab/code/supportsheep
git clone https://github.com/pooriaarab/supportsheep.git .supportsheep-tmp
mv .supportsheep-tmp/* .supportsheep-tmp/.* . 2>/dev/null || true
rm -rf .supportsheep-tmp
rm -rf .git
git init
git add .
git commit -m "chore: Initialize supportsheep from supportsheep foundation"
```

### Task 2: Global Rebranding

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/wrangler.jsonc`

- [ ] **Step 1: Update root package.json**
Run a script to update the root `package.json` name from `supportsheep-monorepo` or `supportsheep` to `supportsheep-monorepo`.
```bash
sed -i '' 's/"name": "supportsheep-monorepo"/"name": "supportsheep-monorepo"/g' package.json
sed -i '' 's/"name": "supportsheep"/"name": "supportsheep"/g' package.json
```

- [ ] **Step 2: Update web app package.json and wrangler.jsonc**
```bash
sed -i '' 's/"name": "web"/"name": "supportsheep-web"/g' apps/web/package.json
sed -i '' 's/"name": "supportsheep"/"name": "supportsheep"/g' apps/web/wrangler.jsonc
```

- [ ] **Step 3: Commit**
```bash
git add package.json apps/web/package.json apps/web/wrangler.jsonc
git commit -m "chore: Rebrand core files to supportsheep"
```

### Task 3: Support Settings Schema

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/web/src/lib/blog-config.ts`

- [ ] **Step 1: Update BlogConfig type**
Modify `packages/types/src/index.ts`. Locate the `export interface BlogConfig` definition and add the `support` block to it:
```typescript
export interface BlogConfig {
  blogId: string;
  // ... existing fields ...
  seo: {
    defaultMetaTitle: string;
    defaultMetaDescription: string;
  }; // existing field
  support?: {
    enableVoice: boolean;
    enableChatbot: boolean;
    openAIApiKey?: string;
  };
}
```

- [ ] **Step 2: Update default config merging**
Modify `apps/web/src/lib/blog-config.ts`. Locate the `normalizePublicBlogConfig` or `mergeBlogConfig` defaults and ensure `support` defaults are applied. Look for where the default object is constructed and add:
```typescript
    support: {
      enableVoice: false,
      enableChatbot: false,
      ...(overrides?.support || {}),
    },
```

- [ ] **Step 3: Commit**
```bash
git add packages/types/src/index.ts apps/web/src/lib/blog-config.ts
git commit -m "feat: Add support schema to tenant config"
```

### Task 4: Admin Dashboard Support Settings

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/support/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx`

- [ ] **Step 1: Create the Support Settings Page**
Create `apps/web/src/app/(dashboard)/settings/support/page.tsx`. This page should contain a form to toggle `enableVoice`, `enableChatbot`, and an input for `openAIApiKey`. Use the existing settings pattern (e.g., fetching `getBlogConfig(blogId)` and a save action).
```tsx
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import { getDb } from "@/db";
import { blogConfig } from "@/db/schema/config";
import { eq } from "drizzle-orm";
// Assume standard settings layout structure is used here
export default async function SupportSettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Support Features</h2>
      <p className="text-gray-600 mb-6">Manage AI Voice and Chatbot settings.</p>
      {/* Implementation of standard settings form here */}
    </div>
  );
}
```

- [ ] **Step 2: Add to Settings Sidebar**
Modify `apps/web/src/app/(dashboard)/settings/layout.tsx`. Locate the sidebar navigation links and add a link to `/settings/support`.
```tsx
// Inside the settings navigation array
{
  title: "Support AI",
  href: "/settings/support",
  icon: "Headset", // Or similar Lucide icon
},
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/\(dashboard\)/settings/support/page.tsx apps/web/src/app/\(dashboard\)/settings/layout.tsx
git commit -m "feat: Add support settings to admin dashboard"
```

### Task 5: Public Tenant Support Widgets

**Files:**
- Create: `apps/web/src/components/public/support-voice-widget.tsx`
- Create: `apps/web/src/components/public/support-chat-widget.tsx`
- Modify: `apps/web/src/components/public/shell.tsx`

- [ ] **Step 1: Create widget components**
Create `apps/web/src/components/public/support-voice-widget.tsx`:
```tsx
"use client";

export function SupportVoiceWidget() {
  return (
    <div className="fixed bottom-4 left-4 p-4 bg-blue-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors z-50 flex items-center gap-2">
      <span className="text-xl">🎙️</span> <span>Live Voice</span>
    </div>
  );
}
```

Create `apps/web/src/components/public/support-chat-widget.tsx`:
```tsx
"use client";

export function SupportChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-gray-900 text-white rounded-full shadow-lg cursor-pointer hover:bg-gray-800 transition-colors z-50 flex items-center gap-2">
      <span className="text-xl">💬</span> <span>Support Chat</span>
    </div>
  );
}
```

- [ ] **Step 2: Inject widgets into the public shell**
Modify `apps/web/src/components/public/shell.tsx`. Pass the `blogConfig` into the shell if not already present, or read it, and conditionally render the widgets:
```tsx
import { SupportVoiceWidget } from "./support-voice-widget";
import { SupportChatWidget } from "./support-chat-widget";
// Inside PublicShell component return:
{config?.support?.enableVoice && <SupportVoiceWidget />}
{config?.support?.enableChatbot && <SupportChatWidget />}
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/public/support-voice-widget.tsx apps/web/src/components/public/support-chat-widget.tsx apps/web/src/components/public/shell.tsx
git commit -m "feat: Inject AI support widgets into tenant public view"
```

### Task 6: Landing Page Overhaul

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Rewrite Landing Page Hero and Features**
Modify `apps/web/src/app/page.tsx` to match the Ferndesk value proposition. Replace the existing blog marketing copy with Supportsheep marketing.
```tsx
export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 text-center px-4">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
          The AI-native support platform with Real-time Voice
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Give your customers instant answers via Chat and Voice. Supportsheep builds your knowledge base and serves it instantly.
        </p>
        <button className="bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition">
          Start Free Trial
        </button>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-2">Real-time AI Voice 🌟</h3>
            <p className="text-gray-600">Customers can talk to your AI agent live, receiving instant audio answers.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-2">Embeddable Chatbot</h3>
            <p className="text-gray-600">A powerful support widget that you can embed anywhere in your app.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-2">Multitenant Custom Domains</h3>
            <p className="text-gray-600">Host your support docs on your own domain with full SSL.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: Overhaul marketing landing page for Supportsheep"
```
