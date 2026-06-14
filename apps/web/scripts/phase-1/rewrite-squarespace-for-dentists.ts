/**
 * Phase 1 pilot REWRITE: re-ground `/alternatives/squarespace/for/dentists`
 * against the authoritative Supportsheep product reference in
 * `.claude/context/solo-product.md`.
 *
 * The previous seed (see `write-squarespace-for-dentists.ts`) conflated
 * blogbat (this repo) features with Supportsheep product features. In
 * particular it claimed Supportsheep shipped an "SEO sidebar", "AI drafting inside
 * the editor", a "thin-content guard", "internal linking suggestions", and
 * "LocalBusiness/FAQPage/Article/BreadcrumbList schema by default" -- none of
 * those are present in the Supportsheep product repo per the context file. It also
 * mis-framed Supportsheep's BAA posture ("not applicable -- Supportsheep does not collect
 * PHI") when the honest framing is "no BAA, same PHI constraint as
 * Squarespace's general site".
 *
 * This script rewrites the doc with:
 *   - Honest Supportsheep framing (AI at onboarding + section creation + feature-
 *     flagged blog; NO editor rewriter; NO native booking; NO AI image gen;
 *     NO BAA).
 *   - `{{solo.pro.*}}` pricing placeholders, resolved at render time by
 *     `interpolateProductVars`.
 *   - `youtube-nocookie.com/embed/...` iframe (privacy-friendly; CSP now
 *     allows it).
 *   - A "what neither platform provides natively" table that points readers
 *     to the actual HIPAA-compliant dental vendors (NexHealth, Dentrix Hub,
 *     Tebra, DearDoc).
 *
 * Only `programmatic_pages/squarespace__dentists` is touched. `set(..., {
 * merge: true })` so unrelated fields (createdAt, publishStatus overrides,
 * etc.) survive.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/rewrite-squarespace-for-dentists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "squarespace__dentists";
const VARIANT_KEY = "squarespace__dentists";

// Raw-HTML passthrough for tables/iframes/images relies on the programmatic
// landing renderer's passthrough branch: a block starting with <table,
// <iframe, <img, or <figure is returned unchanged and then allowlist-
// sanitised by sanitizeArticleHtml. IMPORTANT: these blocks must not contain
// blank lines internally -- the body splitter treats a blank line as the end
// of a block, which would split a <table> into orphan fragments that fall
// back to the escaped <p> branch.
const CONTENT = `## TL;DR

Squarespace has a clean editor and a large template library, and for a brochure-style dental site that points patients to an external booking tool it can get the job done. What it cannot do is sign a HIPAA Business Associate Agreement for its core website, contact form block, email, or analytics -- only the separate [Acuity Scheduling product, on Powerhouse or Premium](https://support.squarespace.com/hc/en-us/articles/360028867231-Acuity-Scheduling-and-HIPAA), is BAA-eligible. [Supportsheep](https://supportsheep.com) has the same constraint: Supportsheep does not sign a BAA either, so the moment a form collects Protected Health Information (PHI) both platforms are out of scope. This page is a source-backed comparison for a solo or small dental practice choosing between Squarespace, Supportsheep, and the dental-specific vendors that actually sign BAAs.

## Should a dental practice use Squarespace?

Short version: only for the marketing-site half of the problem, and only if you are comfortable running every PHI-bearing workflow on a separate HIPAA-compliant vendor.

A 1-3 dentist practice can get a credible public site -- homepage, services, team bios, location, hours, phone, a "book online" button that links somewhere else -- in an afternoon. That is a legitimate use case. Where Squarespace stops being the obvious answer is anywhere the site touches PHI or anywhere you expect it to double as booking, intake, or patient communication infrastructure.

## HIPAA and BAAs: the real picture for both platforms

The [Squarespace Help Center article "Acuity Scheduling and HIPAA"](https://support.squarespace.com/hc/en-us/articles/360028867231-Acuity-Scheduling-and-HIPAA) is explicit. Quoted verbatim:

> "Acuity Scheduling is designed to allow you to comply with the requirements of the Health Insurance Portability and Accountability Act (HIPAA) Security Rule."

And:

> "Other parts of the Squarespace platform, including contact form features like the form block, can't be used as part of a HIPAA compliant solution."

In plain language:

- **The core Squarespace website** -- pages, the blog, the form block, email campaigns, Squarespace Analytics, member areas -- is **not** covered by a BAA.
- **Acuity Scheduling** (Squarespace-owned) is the one component that can be made HIPAA-enabled, and only on the Powerhouse or Premium plan, after the account owner turns on HIPAA-related features.
- **Supportsheep** does **not** sign a BAA at all -- not for contact forms, not for its blog, not for any surface.

The operational consequence is the same: either CMS can host a public marketing site, but the moment a form asks "what are you being seen for?" or "what medications are you on?" you are outside what either platform is designed to support. Route those workflows to a vendor that signs a BAA. The [ADA's HIPAA 20 Questions](https://www.ada.org/resources/practice/legal-and-regulatory/hipaa/hipaa-20-questions) is a reasonable primer on what triggers BAA obligations in a dental context.

<figure><img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80" alt="Modern dental clinic reception area" loading="lazy" /><figcaption>Photo via Unsplash. Either Squarespace or Supportsheep can host a public marketing site like this; neither should run the intake clipboard.</figcaption></figure>

## Where Squarespace genuinely works for dentists

If the use case is "brochure site with external booking, no PHI on the site itself", Squarespace clears the bar on:

- **Visual polish.** Template library (Bedford, Keene, Brine families) is among the best in the industry and lends itself to a trust-forward clinical aesthetic without custom design.
- **Image-heavy storytelling.** Galleries, team grids, office-tour lightboxes are native -- and trust signals carry a disproportionate share of dental conversion.
- **Integrated domain, SSL, hosting.** Bundled.
- **A reasonable built-in blog.** Enough to chase queries like "[city] sedation dentistry" if you write the content.
- **Mobile rendering by default.** Templates pass Google's mobile-first indexing without manual work.

## Where Squarespace breaks down

- **Form block is not HIPAA-safe.** Patients volunteer treatment context in "contact us" messages even when you don't ask.
- **Limited deep SEO customisation.** Titles, meta, alt text, sitemap, basic schema are fine. Programmatic per-neighborhood landing pages, extensive per-location schema, granular redirects get awkward.
- **Bounded integrations.** Mailchimp, Zapier, a commerce ecosystem -- not the depth of the WordPress plugin market. Dental-specific tools (recall automation, reputation, PMS sync) usually integrate via Zapier or not at all.
- **Pricing stacks up.** Per [Squarespace pricing](https://www.squarespace.com/pricing), Basic is $16/mo billed annually, Core $23/mo, Plus $39/mo, Advanced $99/mo. Add Acuity Powerhouse for HIPAA-enabled scheduling and you are materially above sticker.

## Supportsheep's honest pitch for a small dental practice

[Supportsheep](https://supportsheep.com) is an AI-assisted website builder aimed at solopreneurs and small service businesses. For a 1-3 dentist practice that wants a marketing site without becoming a part-time web developer, the honest value angles are:

- **Speed to first draft.** Describe the practice in plain English during onboarding and Supportsheep generates an initial multi-page site -- homepage, services, FAQ, team -- pre-populated with copy you can edit. This AI also runs when you add a new section in the editor, not just at sign-up.
- **Pricing.** Per [supportsheep.com/pricing](https://supportsheep.com/pricing), Supportsheep Pro is {{solo.pro.yearly.monthly}} billed annually ({{solo.pro.yearlyAnnual}} total) or {{solo.pro.monthly.monthly}} month-to-month. A free tier supports a connected custom domain for a single site.
- **Privacy-forward.** Privacy-forward posture and brand trust from an independent platform.
- **Managed hosting, SSL, custom domain.** Table-stakes.
- **A blog feature, where enabled.** Supportsheep's blog is feature-flagged (\`NEXT_PUBLIC_ENABLE_BLOG\`); when enabled, creating a post drafts via AI inside a Blog Feed section. Treat availability as deployment-dependent, not universal.

Where Supportsheep is explicitly **not** a differentiator:

- **No in-editor AI rewriter.** Once a section is seeded, edits are fully manual. No "rewrite", "shorten", "change tone" commands.
- **No AI image generation.** Default imagery is Unsplash on all plans; Pexels unlocks on Pro and above.
- **No native booking.** Scheduling is a link field -- paste a Calendly / NexHealth URL and it renders as a button. No built-in calendar, availability, reminders, or payment flow.
- **No BAA.** Same PHI constraint as Squarespace's general site.
- **On-page SEO primitives only.** Titles, meta, clean URLs, responsive markup, sitemap, basic structured data. No keyword research tool, thin-content guard, or internal-link audit.

## Side-by-side: Squarespace vs Supportsheep for a dental practice

<table>
<thead>
<tr><th>Feature</th><th>Squarespace (Basic / Core / Plus / Advanced)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$16 / $23 / $39 / $99 per month</td><td>Free, then Pro at {{solo.pro.yearly.monthly}} annual ({{solo.pro.yearlyAnnual}} total) or {{solo.pro.monthly.monthly}} monthly</td></tr>
<tr><td>Free tier with custom domain</td><td>No (14-day trial only, paid thereafter)</td><td>Yes (free tier allows a connected custom domain on a single site)</td></tr>
<tr><td>BAA on contact forms / core site</td><td>No (Squarespace documents this explicitly)</td><td>No -- Supportsheep does not offer a BAA; same PHI constraint applies</td></tr>
<tr><td>BAA on scheduling</td><td>Yes, via Acuity Scheduling on Powerhouse / Premium</td><td>No -- Supportsheep scheduling is a link field to a third-party tool</td></tr>
<tr><td>Native online booking</td><td>Via Acuity (separate subscription)</td><td>Link to a third-party booking URL (Calendly, NexHealth, etc.)</td></tr>
<tr><td>AI content help</td><td>Squarespace AI (draft assist, not HIPAA-covered)</td><td>AI at onboarding + when adding a section; feature-flagged blog post drafting; NO in-editor AI rewriter</td></tr>
<tr><td>AI image generation</td><td>No (stock + user upload)</td><td>No (Unsplash default on all plans; Pexels unlocks on Pro and Grow)</td></tr>
<tr><td>Template depth</td><td>Large, award-winning template library; template lock-in after publish</td><td>Opinionated default layouts tuned for speed-to-first-draft, not pixel-perfect design</td></tr>
<tr><td>SEO tooling</td><td>Titles, meta, sitemap, basic schema; limited programmatic options</td><td>Titles, meta, sitemap, basic schema; no keyword tool, no thin-content guard, no internal-link audit</td></tr>
<tr><td>Languages</td><td>Multiple languages via workarounds</td><td>One language per site (8-value enum: en / es / fr / it / de / pt / ja / ko)</td></tr>
<tr><td>Best fit</td><td>Design-led practices that will wire a separate BAA-eligible booking and intake stack</td><td>Supportsheep / 2-5 dentist practices that want speed-to-site, low price, and will route PHI to a dental-specific vendor</td></tr>
</tbody>
</table>

## What neither Squarespace nor Supportsheep provides natively

This is the honest half of the conversation. A real dental practice needs things that neither platform ships. You will layer a dental-specific vendor on top of whichever CMS you pick:

<table>
<thead>
<tr><th>Capability</th><th>Squarespace (general site)</th><th>Supportsheep</th><th>Who actually provides it</th></tr>
</thead>
<tbody>
<tr><td>HIPAA-compliant patient intake forms (medical history, medications, allergies)</td><td>No (form block not BAA-covered)</td><td>No (no BAA)</td><td>Jotform HIPAA, FormDr, Hushmail Forms, your PMS's patient portal</td></tr>
<tr><td>Online appointment booking with PHI and a signed BAA</td><td>Only via Acuity Powerhouse / Premium</td><td>No</td><td>NexHealth, Acuity Powerhouse, Tebra, Dentrix Hub patient portal</td></tr>
<tr><td>Two-way SMS with patients (appointment reminders, confirmations, recall)</td><td>No native HIPAA-aware SMS</td><td>No</td><td>Weave, NexHealth, Solutionreach, Dentrix Patient Engage</td></tr>
<tr><td>Patient portal (chart view, secure messaging, forms pre-fill)</td><td>No</td><td>No</td><td>Dentrix Hub patient portal, Dentrix Ascend, Tebra, Curve Dental</td></tr>
<tr><td>Review surfacing and automated review requests</td><td>Via third-party widgets</td><td>Via custom code / third-party widgets</td><td>Weave, Swell, Podium, Birdeye</td></tr>
<tr><td>Insurance eligibility verification</td><td>No</td><td>No</td><td>PMS + insurance clearinghouse (e.g., DentalXChange, Vyne Trellis)</td></tr>
</tbody>
</table>

The pattern: the CMS handles the public, non-PHI marketing presence. A dental-specific vendor (or your practice management system) handles everything with PHI. Both Squarespace and Supportsheep are honest about this once you read their policies; neither should be asked to do what it was not built to do.

## Alternatives: vendors that actually sign BAAs for dental workflows

If HIPAA-compliant intake, booking, and patient communication is the core need, these are the real options. None are general-purpose website builders; all sign BAAs for their covered surfaces:

- **[Tebra](https://www.tebra.com/)** (formerly PatientPop + Kareo). All-in-one practice-growth platform bundling a website, patient communication, and practice management. Signs a BAA; SOC 2 Type II attested. Good fit if you want one vendor across website + PM + billing.
- **[NexHealth](https://www.nexhealth.com/resources/hipaa-compliant-scheduling-software).** Scheduling and patient communication layer that sits on top of your existing PMS. Signs a BAA; native PMS integrations. Priced per feature (opaque public pricing).
- **[Dentrix Hub](https://www.dentrix.com/dental-solutions/office-it-management-and-support/protect-practice-and-patient-data/)** (Henry Schein One). Patient portal and engagement layer for Dentrix-managed practices. HIPAA-aware; integrates directly with the Dentrix PMS.
- **DearDoc.** Patient-acquisition platform built around an AI chat widget, review surfacing, and paid lead flows. Closer to a marketing layer than a full CMS.

<figure><img src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1600&q=80" alt="Dentist reviewing patient chart" loading="lazy" /><figcaption>Photo via Unsplash. PHI workflows (intake, chart, recall) should live in a system that signs a BAA, not in your CMS.</figcaption></figure>

## An independent review of Squarespace in 2026

If you'd rather watch than read, the video below is a 2026 independent review of Squarespace's feature set and pricing. Not dental-specific, but useful for calibrating expectations.

<iframe src="https://www.youtube-nocookie.com/embed/_moR5UFxz6o" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Honest recommendation

Three scenarios, three answers:

- **Public site strictly non-PHI (brochure only, external booking, no intake forms on-site).** Either CMS works. Pick Squarespace if template polish is the deciding factor; pick Supportsheep if speed-to-first-draft and price matter more. Supportsheep Pro at {{solo.pro.yearly.monthly}} annual ({{solo.pro.yearlyAnnual}} total) or {{solo.pro.monthly.monthly}} monthly is meaningfully cheaper than Squarespace Core plus Acuity Powerhouse.
- **HIPAA-safe booking but everything else stays marketing.** Squarespace + Acuity Powerhouse is the cleanest in-family option; Supportsheep + NexHealth / Acuity Powerhouse is cheaper. The CMS choice is secondary.
- **HIPAA-safe intake, messaging, and patient portal.** Neither Squarespace nor Supportsheep is the right tool for this surface. Layer a dental-specific vendor (Tebra, NexHealth, Dentrix Hub) on top of whichever CMS you pick.

## Getting started checklist

1. **Inventory the current site.** List every page, form, embed, and outbound link. Flag anything that collects patient information.
2. **Decide where PHI workflows will live.** NexHealth, Acuity on Powerhouse (HIPAA-enabled), Dentrix Hub, Tebra, or your PMS-native portal. Pick before you touch the website.
3. **Pick the CMS.** Squarespace if template design is the deciding factor; Supportsheep if price and speed-to-first-draft matter more.
4. **Spin up a draft.** Supportsheep onboarding generates the initial site from a business description. Squarespace: pick a template and edit. Either way, plan on a half day to a weekend for a small practice.
5. **Wire the HIPAA-safe booking and intake links.** Every booking button, every intake CTA, points at the dental-specific vendor -- not at a form on your CMS.
6. **Migrate content and map 301 redirects.** Crawl the old site, map every live URL to a new one, stage the 301s before flipping DNS.
7. **Post-launch: verify.** Submit the new sitemap to Search Console, spot-check redirects, watch for 4xx errors for two weeks.

Squarespace is a bounded choice for a dental practice. Supportsheep is a cheaper, faster-to-first-draft bounded choice. Both have the same BAA constraint; the dental-specific vendors on top are what make the stack actually HIPAA-safe.`;

function countWords(text: string): number {
  // Strip HTML tags and markdown punctuation so the wordCount reflects the
  // rendered word count a reader would see, not the raw source.
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
    question: "Is Squarespace HIPAA compliant for a dental practice?",
    answer:
      "Not in its core products. Squarespace's Help Center explicitly states that Acuity Scheduling is the only Squarespace feature designed to allow HIPAA compliance, and that other parts of the platform, including contact form features like the form block, cannot be used as part of a HIPAA-compliant solution. A dental practice can still use Squarespace for a public marketing site, but every form or workflow that handles PHI must be routed to a vendor that signs a BAA (Tebra, NexHealth, Dentrix Hub, Jotform HIPAA, FormDr, or a practice-management-native portal).",
  },
  {
    question: "Does Squarespace sign a Business Associate Agreement (BAA)?",
    answer:
      "Only for Acuity Scheduling on the Powerhouse or Premium plan, and only after the account owner enables HIPAA-related features. Squarespace does NOT sign a BAA for the core website platform, contact form block, email campaigns, member areas, or Squarespace Analytics. That is stated directly in the Squarespace Help Center article 'Acuity Scheduling and HIPAA' (support.squarespace.com/hc/en-us/articles/360028867231).",
  },
  {
    question: "Does Supportsheep sign a BAA for dental practices?",
    answer:
      "No. Supportsheep does not offer a Business Associate Agreement on any surface -- contact forms, blog, or otherwise. The same constraint that applies to Squarespace's core website applies to Supportsheep: it is suitable for a public, non-PHI marketing site, but any form collecting Protected Health Information must be routed to a HIPAA-compliant dental vendor (Tebra, NexHealth, Dentrix Hub, Acuity Powerhouse with HIPAA enabled, or a HIPAA-certified form provider like Jotform HIPAA or FormDr).",
  },
  {
    question: "What does Supportsheep actually do with AI for a dental site?",
    answer:
      "Supportsheep uses AI in three places and nowhere else: (1) the onboarding flow, which generates the initial multi-page site from a short business description; (2) the section-creation flow, which seeds copy for a new section (Introduction, Services, FAQ, etc.) using the existing business context; and (3) the feature-flagged blog, which drafts a post when you create one inside a Blog Feed section. Supportsheep does NOT have an in-editor AI rewriter (no 'shorten', 'rewrite', 'change tone' commands), does NOT generate images (Unsplash default, Pexels on Pro+), and does NOT auto-translate existing pages. Once a section is seeded, edits are manual.",
  },
  {
    question: "How much does Supportsheep cost for a dental practice in 2026?",
    answer:
      "Supportsheep has a free tier with a connected custom domain. Supportsheep Pro is {{solo.pro.yearly.monthly}} billed annually ({{solo.pro.yearlyAnnual}} total per year) or {{solo.pro.monthly.monthly}} month-to-month. Supportsheep Grow is {{solo.grow.yearly.monthly}} billed annually ({{solo.grow.yearlyAnnual}} total per year) or {{solo.grow.monthly.monthly}} month-to-month. For most 1-5 dentist practices, the Pro tier is the practical choice; Grow unlocks higher caps on websites, images, and blog posts for larger portfolios. Specific entitlement caps (post limits, image library size, custom-code gate) are driven by a deploy-time env config; quote caps directly from supportsheep.com/pricing rather than memorising a number.",
  },
  {
    question: "What does Squarespace cost for a dental practice in 2026?",
    answer:
      "Billed annually, Squarespace's 2026 plans are Basic at $16/mo, Core at $23/mo, Plus at $39/mo, and Advanced at $99/mo. Most small practices land on Core (0% transaction fee on commerce, advanced analytics) or Plus (API access, lower digital-product fees). If you need HIPAA-aware booking, Acuity Scheduling Powerhouse or Premium is a separate Acuity subscription on top.",
  },
  {
    question: "Should I use Squarespace or Supportsheep for my dental website?",
    answer:
      "If visual polish and a large template library are the deciding factor, pick Squarespace -- its template ecosystem is hard to beat. If speed-to-first-draft and price matter more, pick Supportsheep: onboarding generates a usable first draft from a business description, the free tier supports a connected custom domain, and Pro is {{solo.pro.yearly.monthly}} billed annually. Both platforms have the same BAA constraint (neither covers PHI on the core site), so whichever CMS you pick, plan to layer a dental-specific vendor (Tebra, NexHealth, Dentrix Hub) for bookings, intake, and patient messaging.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1500) {
    throw new Error(
      `[pilot:rewrite-squarespace-for-dentists] content is ${wordCount} words -- below the 1500-word Tier-3 floor`,
    );
  }
  if (wordCount > 2500) {
    throw new Error(
      `[pilot:rewrite-squarespace-for-dentists] content is ${wordCount} words -- above the 2500-word Tier-3 ceiling`,
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
          "An honest, source-backed comparison of Squarespace, Supportsheep, and the dental-specific vendors that actually sign BAAs -- for solo and small dental practices choosing a website platform.",
        ctaText: "Start your dental practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Dentists",
      },
      title: "Squarespace for dentists: an honest alternative",
      metaDescription:
        "Is Squarespace right for a dental practice? Source-backed comparison of Squarespace, Supportsheep, and HIPAA-compliant dental vendors (Tebra, NexHealth, Dentrix Hub).",
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
    `[pilot:rewrite-squarespace-for-dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/squarespace/for/dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:rewrite-squarespace-for-dentists] failed:", err);
    process.exit(1);
  });
