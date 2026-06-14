# Supportsheep Migration Design Spec

## Overview
Migrate the existing support platform functionality from `solo-support` to a new, multitenant architecture based on the `blogbat` codebase. The new platform, **Supportsheep**, will be hosted on Cloudflare (moving away from Firebase/Netlify). It will heavily mimic the landing page structure of Ferndesk while highlighting our unique selling proposition: Real-time AI Voice Support.

## Core Objectives
1.  **Infrastructure Migration:** Transition from Firebase/Netlify (`solo-support`) to Cloudflare Pages/Workers (`blogbat` architecture).
2.  **Multitenancy:** Ensure users can sign up, manage their own subdomains (e.g., `tenant.supportsheep.com`), and configure custom domains.
3.  **UI/UX Rebranding:** Complete overhaul of the landing page to match Ferndesk's feature marketing, with a focus on Voice and Chatbot capabilities.
4.  **Support Features Porting:** Integrate specific support components from `solo-support` into the `blogbat` chassis (Search-centric layout, AI Chatbot, Voice Widget, "Was this helpful" feedback).
5.  **Admin Customization:** Provide a dashboard for tenants with basic toggles (Voice on/off, Chatbot on/off), branding (colors/logo), and API key management (OpenAI, etc.).

## Architecture
*   **Foundation:** A direct clone of the `pooriaarab/blogbat` repository.
*   **Hosting:** Cloudflare Pages (Frontend) and Cloudflare Workers (Backend API/Routing if applicable based on blogbat).
*   **Database:** Matches `blogbat`'s existing DB architecture (likely D1 or similar Cloudflare native DB) for managing tenant settings, users, and markdown content.
*   **Frontend:** React/Next.js (matching blogbat).

## Implementation Strategy (Approach 1: Blogbat First)
1.  **Clone & Rebrand:** Clone `blogbat`. Find and replace all instances of "blogbat" to "supportsheep". Update favicons, metadata, and SEO tags.
2.  **Landing Page Overhaul:** Redesign the root `supportsheep.com` landing page.
    *   Hero section emphasizing Voice/Chat.
    *   Feature grid matching Ferndesk's structure.
    *   Pricing and Testimonial placeholders.
3.  **Port Support UI:**
    *   Modify the tenant's public view from a standard "Blog" layout to an "AI-First Support" layout (Search bar, categories, Chatbot/Voice widget integration).
    *   Bring over the "was this helpful" widget code from `solo-support`.
4.  **Admin Dashboard Updates:**
    *   Add a "Support Settings" tab in the admin area.
    *   Add toggles for UI elements (Search, Chatbot, Voice).
    *   Add fields for custom API keys required by the AI features.
5.  **Environment Setup:** Configure the `.env.local` to align with the new Cloudflare infrastructure and the required AI keys.
6.  **E2E Testing:** Verify the complete flow: Signup -> Subdomain creation -> Article creation -> Custom Domain setup -> Public viewing of AI features.

## Out of Scope (For Initial Release)
*   Automated GitHub PR ingestion and AI documentation drafting (Ferndesk's core feature). We will market this as "Coming Soon" or imply it on the landing page, but the backend implementation is excluded from this migration phase.
*   Complex drag-and-drop page building for tenants.

## Testing Strategy
*   Manual E2E testing of the multitenancy flow (signup, login, create post, view post on subdomain).
*   Verification of Cloudflare deployment logs for staging and production environments.
