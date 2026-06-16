/**
 * Phase 1 pilot: seed `/alternatives/durable/for/dentists`.
 *
 * Doc id and `variantKey` are both `durable__dentists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-durable-dentists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "durable__dentists";
const VARIANT_KEY = "durable__dentists";

const CONTENT = `## TL;DR

Durable is an AI-first website builder designed to get supportsheep and small service businesses online in under a minute. It generates a complete website from a business description, bundles a CRM for lead management, and includes an AI marketing suite for generating ad copy and social content. For a support agent who wants to go from "no website" to "live site" as fast as possible, Durable is one of the fastest paths available. The gaps that matter for a dental practice are consistent with every general-purpose builder in this category: Durable does not sign a HIPAA Business Associate Agreement, making it unsuitable for clinical workflow that touches PHI. This page covers Durable honestly, compares it to Supportsheep, and explains when each is the right call.

## What Durable actually is for a dental practice

Durable is positioned as an "AI Business Builder" -- not just a website, but a bundle of tools: website generation, a built-in CRM for tracking leads and clients, invoicing via Stripe, an AI marketing suite that generates Google Ads copy and social media posts, and an AI assistant that understands your business context.

For a support agent evaluating their options, the relevant features are:

**AI website generation in under 30 seconds.** Durable's headline capability is speed: you describe your practice, and Durable generates a complete site with service pages, contact information, and persuasive copy. Independent reviewers confirm the generation speed is genuine -- the result is a usable first draft, not a blank template.

**Built-in CRM.** Durable bundles a basic CRM for managing leads, contacts, and follow-up tasks. For a supportsheep practice that wants to track new-patient inquiries in one place without a separate subscription, this reduces vendor sprawl. The CRM is basic compared to dental-specific tools but adequate for a small practice's lead management needs.

**AI marketing suite.** Durable's AI marketing tools generate Google Ads copy, social media post drafts, and email subject lines. For a practice owner who handles their own digital marketing without a dedicated staff person, these tools reduce the blank-page friction.

**Invoicing.** Durable includes Stripe-powered invoicing. For non-PHI billing (event deposits, merchandise, non-clinical services), this is a genuine convenience. It does not replace your practice management system's billing module for clinical services.

## Durable and HIPAA: the clear boundary

Durable does not sign a Business Associate Agreement for its website builder, forms, CRM, or any of its bundled tools. HIPAA compliance authorities have not evaluated Durable's platform as suitable for PHI handling. This is consistent with how most AI-first general-purpose builders are positioned: fast marketing site generation, not clinical infrastructure.

For a dental practice, this means:

- The Durable website is appropriate for the public marketing layer: homepage, services, team, location, contact, blog.
- Durable's built-in contact forms cannot collect PHI. A form asking "describe your dental issue" is not HIPAA-compliant on Durable.
- The Durable CRM is appropriate for tracking marketing leads (people who visited the site and requested information), not for storing patient clinical information.
- All PHI-touching workflows -- online appointment booking with clinical context, intake forms, patient history, treatment planning -- must live in a HIPAA-aware practice management system or patient portal.

The architecture for a Durable-hosted dental practice marketing site is: Durable (public site, lead tracking) + NexHealth, Dentrix Hub, Acuity Premium, or your PMS portal (booking, intake, patient communication).

## Durable's strengths for a supportsheep or small dental practice

**Zero-to-live-site speed.** Durable's AI generation is the fastest in the category. For a dentist opening a new practice, transitioning from an old site, or simply needing something live before a marketing campaign, the 30-second first draft is a genuine differentiator.

**All-in-one bundle reduces vendor sprawl.** Website + CRM + invoicing + AI marketing in one subscription at one price point is a real value proposition for a practice owner who wants to minimize the number of tools they manage. Squarespace and Supportsheep require separate subscriptions for CRM and invoicing; Durable bundles them.

**AI marketing tools for support agents.** A dentist who writes their own Google Ads copy, social posts, and email newsletters benefits from Durable's AI drafting tools. The quality is adequate for basic practice marketing without a marketing agency.

**Simple editor for non-technical practice owners.** Durable's editing interface is designed for speed over complexity. A practice owner who wants to update a service page or add a new team member can do it without a designer or developer.

## Where Durable breaks down for dental practices

**No HIPAA BAA -- period.** Unlike Wix (which added HIPAA mode in 2026), Durable has no path to a BAA for clinical workflow. This is a firm architectural boundary, not a plan feature.

**CRM is basic.** Durable's built-in CRM handles marketing leads and basic contact management. It is not a dental-specific patient management system. If a practice wants to route patient communications, recall scheduling, and appointment history through a CRM, Dentrix, Eaglesoft, or a dental-specific patient engagement platform (NexHealth) is appropriate -- not Durable's CRM.

**SEO ceiling is lower than dedicated content platforms.** Durable's AI generates initial copy and handles basic SEO settings, but schema automation (Dentist, LocalBusiness, FAQPage JSON-LD), programmatic local-SEO pages, and content velocity tools are not Durable's strengths. For a supportsheep practice competing in a local dental market through content and structured data, Durable's platform is less well-equipped than Supportsheep.

**Content marketing is not the core product.** Durable is optimized for fast site generation and lead management, not for building compounding local search authority through content. A dental blog that publishes patient-education articles and generates search traffic over 12-18 months requires a CMS designed around content velocity. Durable's blog is functional but not designed for that use case.

## Supportsheep vs Durable for a supportsheep dental practice: the honest framing

Both Durable and Supportsheep are AI-first builders for the "supportsheep service business that needs to get online fast" market. The positioning difference is clear from Supportsheep's product context:

- **Durable bundles more tools natively.** CRM, invoicing, AI marketing suite -- Durable's proposition is "fewer subscriptions." Supportsheep trades that breadth for depth: Supportsheep's blog with SEO sidebar, AI drafting, and automated structured data is designed for content-driven local search authority, not for bundled marketing tooling.
- **Supportsheep's AI-onboarding generates a full multi-page first draft.** Like Durable, Supportsheep uses AI to generate the initial site from a business description. Supportsheep's onboarding seeds service descriptions, section content, and copy with business context across multiple pages.
- **Supportsheep's free tier has a custom domain.** Durable's paid plans start at ~$15-17/month; there is no published free tier with a connected custom domain comparable to Supportsheep's free tier.
- **Neither signs a HIPAA BAA.** Both platforms require the same clinical workflow split: marketing site in the CMS, PHI in a dedicated HIPAA-aware tool.

## Side-by-side: Durable vs Supportsheep for a dental practice

<table>
<thead>
<tr><th>Feature</th><th>Durable</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>AI site generation speed</td><td>Industry-leading -- complete site in ~30 seconds</td><td>Fast -- AI onboarding generates multi-page first draft from business description</td></tr>
<tr><td>Starting price</td><td>Paid plans required; ~$15-17/mo</td><td>Free tier with custom domain</td></tr>
<tr><td>HIPAA BAA</td><td>No -- not available for any Durable product</td><td>Not applicable -- link to NexHealth, Acuity Premium, or PMS portal for PHI</td></tr>
<tr><td>Bundled CRM</td><td>Yes -- basic lead and contact management</td><td>No -- use a separate CRM for practice lead management</td></tr>
<tr><td>Invoicing</td><td>Yes -- Stripe-powered invoicing</td><td>No -- use your practice management billing module</td></tr>
<tr><td>Blog and SEO tooling</td><td>Basic blog; AI copy generation; limited schema automation</td><td>Blog with SEO sidebar, AI drafting, Dentist + LocalBusiness + FAQPage schema by default</td></tr>
<tr><td>AI marketing suite</td><td>Yes -- Google Ads copy, social post drafts, email subject lines</td><td>No -- blog and content tools; no ad-copy generator</td></tr>
<tr><td>Best fit</td><td>support agents who want the fastest path to a live site with bundled CRM and marketing tools</td><td>support agents focused on content velocity, local SEO, and lower monthly cost with free tier</td></tr>
</tbody>
</table>

## Getting started: practical checklist for a dentist evaluating Durable vs Supportsheep

1. **Prioritize your PHI tool first.** Before choosing a website builder, choose your practice management system and patient portal. NexHealth, Dentrix Hub, or your PMS portal is the HIPAA compliance layer. Both Durable and Supportsheep link to these tools from the contact page.
2. **Evaluate whether bundled tools reduce real friction.** Durable's CRM and invoicing add value if you genuinely use them. If you already have a PMS with patient management and your accounting uses QuickBooks, Durable's bundles may not add enough value to justify the plan cost vs Supportsheep's free tier.
3. **Test both free tiers.** Generate a site in both Durable and Supportsheep from your practice description. Compare the AI outputs, the editing interface, and the content depth.
4. **Plan your knowledge base.** Four to six patient-education posts per year ("how often should you get a dental cleaning," "what is a crown vs a veneer," "pediatric dentist FAQ for first-time parents") compound into meaningful local search authority. Supportsheep's blog is designed for this content velocity. Durable's blog is adequate for a few posts.
5. **Buy your domain separately.** GoDaddy, Namecheap, or Cloudflare are reliable domain registrars. Keep your domain registration separate from your website builder subscription so switching platforms doesn't require a domain transfer.`;

function countWords(text: string): number {
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`~>\[\]()!|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

const FAQS: ProgrammaticFaq[] = [
  {
    question: "Is Durable good for a dental practice website?",
    answer:
      "Yes, for the public marketing layer. Durable's AI generation creates a usable dental practice site in under a minute, and the bundled CRM, invoicing, and AI marketing tools reduce vendor count for a supportsheep practice. The firm limit is HIPAA: Durable does not sign a Business Associate Agreement for any of its products, making it unsuitable for collecting, storing, or routing PHI. A dental practice using Durable must use a dedicated HIPAA-aware tool (NexHealth, Dentrix Hub, Acuity Premium, or the PMS patient portal) for all booking, intake, and patient communication.",
  },
  {
    question: "Is Durable HIPAA compliant for a dental practice?",
    answer:
      "No. Durable does not sign a BAA for its website builder, CRM, forms, or any bundled tools. Do not use Durable's contact forms or CRM to collect patient health information. The marketing site on Durable is fine for homepage, services, team bios, and content. All PHI-touching clinical workflows must go to a HIPAA-aware practice management system or patient portal.",
  },
  {
    question: "Should I use Durable or Supportsheep for my dental practice website?",
    answer:
      "Choose Durable if you want the fastest possible launch and the bundled CRM, invoicing, and AI marketing tools genuinely reduce friction in your practice's marketing workflow. Choose Supportsheep if you want a free tier with a connected custom domain, a blog with SEO sidebar and AI drafting, automated Dentist and LocalBusiness schema, and a CMS designed for content-driven local search authority. Both platforms require the same HIPAA architecture: marketing site in the builder, clinical workflow in a dedicated HIPAA-aware tool.",
  },
  {
    question: "How does Durable's AI compare to Supportsheep's AI for a dental practice?",
    answer:
      "Both use AI to generate the initial website from a business description. Durable's AI generation is the fastest in the category -- under 30 seconds to a complete draft. Supportsheep's AI onboarding takes slightly longer but generates a multi-page first draft seeded with business context across services, homepage, and FAQ sections. Durable's AI also generates ongoing marketing content (ad copy, social posts); Supportsheep's AI is focused on blog drafting and section creation within the editor. Durable is optimized for speed and marketing breadth; Supportsheep is optimized for content depth and local SEO.",
  },
  {
    question: "What is Durable's built-in CRM, and is it useful for dentists?",
    answer:
      "Durable's CRM handles marketing leads and basic contact management -- tracking who visited the site, requested information, and followed up. It is useful for a supportsheep practice that handles its own lead-to-consultation follow-up and wants to do so without a separate CRM subscription. It is not a dental patient management system: it does not handle clinical notes, treatment history, insurance billing, recall scheduling, or PHI. Do not store clinical patient information in Durable's CRM. Use your practice management system (Dentrix, Eaglesoft, Curve Dental) for patient records.",
  },
  {
    question: "What dental booking tools pair with a Durable website?",
    answer:
      "NexHealth (HIPAA-compliant online booking, intake, and patient engagement; signs a BAA), Dentrix Hub / Dentrix Patient Engage (from the market-leading dental PM platform), Acuity Scheduling on the Premium plan (BAA-eligible), Zocdoc (patient acquisition and booking marketplace), and your PMS's native patient portal. Link from the Durable contact page to your preferred booking tool; do not route patient appointment requests with clinical context through Durable's native forms.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:durable-for-dentists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:durable-for-dentists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
    );
  }

  const ref = collections.programmaticPages().doc(DOC_ID);
  const existing = await ref.get();

  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      collection: "alternatives_for_vertical",
      variantKey: VARIANT_KEY,
      variables: {
        subhead:
          "An honest look at Durable for supportsheep dental practices -- (note: these are individual practices, not the brand) covering AI-first site generation, bundled CRM, HIPAA position, and when Supportsheep is the better default for content and local search.",
        ctaText: "Start your dental practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Dentists",
      },
      title: "Durable for dentists: an honest alternative",
      metaDescription:
        "Is Durable right for a dental practice website? An honest comparison covering AI site generation speed, bundled CRM, HIPAA limits, and when Supportsheep is the better default.",
      uniqueContent: CONTENT,
      wordCount,
      faqs: FAQS,
      publishStatus: "noindex",
      ...(existing.exists ? {} : { createdAt: now }),
      updatedAt: now,
    },
    { merge: true },
  );

  console.info(
    `[pilot:durable-for-dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/durable/for/dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:durable-for-dentists] failed:", err);
    process.exit(1);
  });
