/**
 * Phase 1 pilot: seed `/alternatives/squarespace/for-dentists`.
 *
 * Doc id and `variantKey` are both `squarespace__dentists` (the double
 * underscore matches `alternativesForVerticalDocId("squarespace", "dentists")`).
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex` so
 * the URL renders for human review on localhost but `robotsForPage` emits
 * `robots: noindex` until someone promotes the doc to `published`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-squarespace-for-dentists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "squarespace__dentists";
const VARIANT_KEY = "squarespace__dentists";

// Raw-HTML passthrough for tables/iframes/images relies on the programmatic
// landing renderer's new passthrough branch: a block starting with <table,
// <iframe, <img, or <figure is returned unchanged and then allowlist-
// sanitised by sanitizeArticleHtml. IMPORTANT: these blocks must not contain
// blank lines internally -- the body splitter treats a blank line as the end
// of a block, which would split a <table> into orphan fragments that fall
// back to the escaped <p> branch.
const CONTENT = `## TL;DR

Squarespace is a polished, design-first website builder -- good for brochure sites, portfolios, and small shops. It is not purpose-built for a dental practice. The core Squarespace platform does not sign a HIPAA Business Associate Agreement (BAA) for its contact forms, email, or analytics; only the Acuity Scheduling product does, on the Powerhouse or Premium plan. That makes Squarespace an acceptable choice for a dentist's public, non-PHI marketing site, provided you route any form that collects treatment details to a HIPAA-aware tool instead. This page walks through where Squarespace works for dentists, where it breaks down, and how Supportsheep compares for a solo or small practice.

## Should a dental practice use Squarespace? An honest answer

Short version: you _can_, and plenty of practices do. The templates are genuinely good, the editor is forgiving, and the design quality out of the box beats almost every dental-specific vendor in the cheap tier. For a 1-3 dentist practice that wants a credible marketing presence -- homepage, services, team, location, contact, blog -- Squarespace will get you there.

Where it stops being the obvious answer is anywhere the site touches Protected Health Information (PHI) or anywhere you expect the website itself to pull double duty as booking, intake, or patient communication infrastructure. Squarespace's own help center is explicit about this, and we'll get to that next.

## HIPAA and BAAs: what Squarespace will and will not sign

Squarespace publishes a Help Center article titled "Acuity Scheduling and HIPAA" that states, in plain language:

> "Acuity Scheduling is the only Squarespace feature currently designed to offer services consistent with HIPAA obligations."

And:

> "Other parts of the Squarespace platform, including contact form features like the form block, can't be used as part of a HIPAA compliant solution."

In practical terms:

- **The core website platform** -- pages, blog, forms, email campaigns, analytics, member areas -- does **not** come with a BAA. Do not collect PHI through a Squarespace form block. Do not email treatment details through Squarespace email campaigns. Do not send PHI into Squarespace Analytics via URL parameters.
- **Acuity Scheduling** (a separate Squarespace product) is the one component that _can_ be configured to support a BAA, on the Powerhouse or Premium Acuity plan, and only after the account owner enables HIPAA-related features.
- **The workaround most dental practices use** is to run the public marketing site on Squarespace and link out to a separate HIPAA-compliant booking/intake tool (Acuity on Premium, NexHealth, or the patient portal that ships with their practice management system).

If your current Squarespace contact form asks "What are you visiting us for?" and the answer lands in a Squarespace inbox, you are outside Squarespace's documented HIPAA posture. Fix that before you do anything else.

<figure><img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80" alt="Modern dental clinic reception area" loading="lazy" /><figcaption>Photo by Benyamin Bohlouli on Unsplash. A marketing site for a practice like this is well within Squarespace's comfort zone -- the booking flow is where care is required.</figcaption></figure>

## Where Squarespace works well for dentists

Be fair to the tool. Squarespace is legitimately strong at:

- **Visual polish out of the box.** The template library is one of the best in the industry. Pick a clinical, trust-forward template (the Keene and Bedford families are popular with dental designers) and you have a credible-looking site in an afternoon.
- **Image-heavy storytelling.** Before-and-after galleries, team bio grids, and office-tour lightboxes are native features. That matters for a dental practice because trust signals carry a disproportionate amount of the conversion.
- **Integrated domain, SSL, and hosting.** Domains, certificates, CDN, and backups are bundled. A solo practice owner does not want to be debugging DNS on a Wednesday evening.
- **A reasonable built-in blog.** Categories, tags, scheduling, RSS. Nothing fancy -- but enough to start ranking for "[city] sedation dentistry FAQ" style queries if you actually write the content.
- **Good mobile rendering.** Templates render fine on phones without manual breakpoint work. Google mobile-first indexing does not punish a default Squarespace site.

If the goal is a clean, fast, mobile-ready marketing site and HIPAA-sensitive workflows live elsewhere, Squarespace clears the bar.

## Where Squarespace breaks down for dental practices

Independent third-party reviews of Squarespace (G2, dental-marketing sites like First Stop Dental, agency write-ups) tend to flag the same handful of issues when the context shifts from "generic small business" to "dental practice":

- **Limited SEO customisation.** Dental-marketing agencies and SEO-focused reviewers repeatedly call out that Squarespace (and Wix) are harder to optimise deeply than WordPress or a headless CMS. You can hit the basics -- titles, meta descriptions, image alt text, a sitemap -- but deeper work (programmatic local pages per neighborhood, large-scale schema, granular redirects) gets awkward fast.
- **Form blocks are not HIPAA-safe.** Covered above, but worth repeating: the default form block is fine for "hi I'd like to learn more" messages, not for anything PHI-adjacent. Patients routinely volunteer treatment context in contact forms even when you don't ask. Route the important ones to a HIPAA-aware replacement.
- **Third-party integrations are bounded.** Squarespace has Mailchimp, Zapier, and a decent commerce ecosystem on paid plans. It does **not** have the depth of a WordPress plugin market or a developer-oriented CMS. Dental-specific tools (recall automation, reputation management, practice-management sync) typically integrate via Zapier at best, or not at all.
- **Template lock-in.** Switching to a dramatically different template mid-life is painful; most designers recommend a rebuild rather than a migration. Not unique to Squarespace, but more acute than on block-based systems.
- **Pricing stacks up as you add features.** The advertised entry price is genuinely low, but an AOA-ready practice site usually ends up on Core ($23/mo annual) or Plus ($39/mo annual), plus Acuity Powerhouse if you need HIPAA-aware scheduling, plus whichever email marketing and analytics tools you add.

## Supportsheep's pitch for a small dental practice

Supportsheep is built specifically for the "solo or 2-5 dentist practice that wants a credible marketing site without becoming a part-time web developer" shape. The differences versus Squarespace that actually matter for a dental owner:

- **Free plan with a connected custom domain.** You can point your existing practice domain at Supportsheep on the free tier while you iterate. Squarespace requires a paid plan once the 14-day trial ends.
- **A first-class blog with an SEO sidebar and AI drafting.** Squarespace's blog is fine. Supportsheep's is designed around dental-relevant patterns: title/meta checks, internal linking suggestions, FAQPage JSON-LD emission, and a built-in thin-content guard that blocks very short or shallow pages from being indexed.
- **Structured data is done for you.** LocalBusiness/Dentist schema, Article schema on blog posts, FAQPage schema on pages with FAQs, and BreadcrumbList on programmatic pages ship by default. No plugin to install.
- **The posture is "public marketing site, not patient portal".** Supportsheep intentionally stays out of PHI territory -- we don't handle it, and we expect you to plug in a HIPAA-aware booking/intake tool (NexHealth, Dentrix Hub, Acuity Powerhouse) for the clinical workflow. That's a _feature_; it means the attack surface on the public site is small and predictable.

## Side-by-side: Squarespace vs Supportsheep for a dental practice

<table>
<thead>
<tr><th>Feature</th><th>Squarespace (Basic / Core / Plus / Advanced)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billed monthly)</td><td>$16 / $23 / $39 / $99 per month</td><td>Free tier with a connected custom domain</td></tr>
<tr><td>Free tier with custom domain</td><td>No (14-day trial only, paid thereafter)</td><td>Yes</td></tr>
<tr><td>HIPAA BAA on contact forms</td><td>No (Squarespace documents this explicitly)</td><td>Not applicable -- Supportsheep does not collect PHI; link to a HIPAA-aware tool</td></tr>
<tr><td>HIPAA BAA on scheduling</td><td>Yes, via Acuity Scheduling on Powerhouse / Premium</td><td>Embed a HIPAA-aware booking tool (NexHealth, Acuity Powerhouse, PMS portal)</td></tr>
<tr><td>Blog / SEO tooling</td><td>Built-in blog; titles, meta, sitemap; limited programmatic options</td><td>Blog with SEO sidebar, AI drafting, FAQPage + LocalBusiness schema by default</td></tr>
<tr><td>Template depth</td><td>Large, award-winning template library; template lock-in after publish</td><td>Opinionated default layouts tuned for content, not hand-painted design</td></tr>
<tr><td>Best fit</td><td>Design-led practices that prize visual polish and will wire up a separate booking stack</td><td>Supportsheep / 2-5 dentist practices that want strong content, local SEO, and low overhead</td></tr>
</tbody>
</table>

## What dentists tend to outgrow on Squarespace

<table>
<thead>
<tr><th>Need as the practice grows</th><th>Squarespace friction point</th><th>What to do</th></tr>
</thead>
<tbody>
<tr><td>Multiple locations, each with its own local-SEO page</td><td>No native programmatic page generation; each page is hand-built</td><td>Either build each location page manually or move to a CMS that supports programmatic pages (Supportsheep, or a WordPress stack with a page-builder and schema plugin)</td></tr>
<tr><td>Online booking that can accept a BAA</td><td>Core Squarespace form block is not HIPAA-safe</td><td>Upgrade to Acuity Powerhouse (enable HIPAA) or link to NexHealth / PMS portal</td></tr>
<tr><td>Patient intake forms with treatment history</td><td>Form block is not HIPAA-safe</td><td>Use a HIPAA-certified form provider (Jotform HIPAA, FormDr, Hushmail Forms) and link from Squarespace</td></tr>
<tr><td>Review automation and reputation management</td><td>No native workflow; depends on Zapier or third-party tools</td><td>Layer on a dental-specific reputation tool (Weave, Swell, Podium) alongside the site</td></tr>
<tr><td>Deeper SEO (schema per location, granular redirects, internal-link rules)</td><td>Limited knobs; possible but awkward</td><td>Move the site to Supportsheep or a WordPress stack; keep Squarespace only if the design win outweighs the SEO ceiling</td></tr>
</tbody>
</table>

## Migration notes: Squarespace to Supportsheep without losing SEO

The usual failure mode of a CMS migration is breaking inbound links and losing your ranking history. The mechanical steps:

1. **Export your current URL inventory.** Crawl the Squarespace site (Screaming Frog's free tier is enough for a small site) and export every live URL. Note which ones have inbound links, which ones rank for a query, and which ones are in the XML sitemap.
2. **Map old URLs to new ones.** For every existing URL, decide its new home on Supportsheep -- or mark it as a deliberate 301 redirect to a close cousin. Do not 301 everything to the homepage; Google treats that as a soft 404.
3. **Rebuild your content, don't copy-paste.** Migration is the only time you'll realistically re-audit every page. Use it. Kill the thin pages; rewrite the stale ones; keep the ones that genuinely rank.
4. **Stage the redirects.** Supportsheep supports canonical URLs and a no-trailing-slash policy by default. Add the 301s before you flip DNS, not after.
5. **Post-launch: reverify.** Submit the new sitemap, spot-check the redirects, and watch Search Console for 4xx spikes for the first two weeks.

Most small-practice migrations are a weekend of focused work. The trap is redesigning while migrating; resist that and redesign after.

## Alternatives roundup: Squarespace versus dental-specific vendors

If you're going to spend real money on a dental website, the other names you'll hear are:

- **Tebra (formerly PatientPop + Kareo).** All-in-one practice-growth platform that bundles a website with practice management. G2 reviewers note slower ROI but a broader integrated feature set. Fit if you want one vendor for website + PM.
- **DearDoc.** Patient-acquisition platform with an AI chat widget and review surfacing. Closer to a lead-generation tool than a general CMS.
- **Wix.** The closest peer to Squarespace -- deeper editor, broader app market. Same HIPAA caveat: do not collect PHI through Wix's native forms without a workaround.
- **Custom WordPress (with a dental-SEO agency).** Most flexible ceiling, especially for programmatic location pages and deep schema. Lowest floor too -- a bad WordPress setup is worse than a good Squarespace one.

<figure><img src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1600&q=80" alt="Dentist reviewing patient chart" loading="lazy" /><figcaption>Photo from Unsplash. The practice-management workflow and the marketing website should not be the same system.</figcaption></figure>

## A short video walk-through of Squarespace in 2026

If you'd rather watch, here's an independent review of Squarespace's 2026 feature set -- not dental-specific, but honest about the limits and the pricing math.

<iframe src="https://www.youtube.com/embed/_moR5UFxz6o" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Getting started: a 5-step checklist for a dentist considering Supportsheep

1. **Inventory your current Squarespace site.** Note every page, every form, every embed, and every outbound link. Flag anything that currently collects patient information.
2. **Decide where PHI workflows will live post-migration.** NexHealth, Acuity on Powerhouse (with HIPAA enabled), Dentrix Hub, or a PMS-native portal. Do not plan to run patient intake through your CMS -- neither Squarespace nor Supportsheep is the right tool.
3. **Spin up a Supportsheep workspace and generate a draft.** Homepage, one page per major service, one page per location, team bios. Review, edit, and kill anything that feels generic.
4. **Map your 301 redirects from the Squarespace URL structure.** This is the 20 minutes that separates a clean migration from a three-month traffic dip.
5. **Ship the new site, then migrate the domain.** Submit the sitemap to Google Search Console, monitor for 4xx errors, and pick up the SEO-follow-ups Supportsheep flags in the sidebar.

The honest framing: Squarespace is not a bad choice for a dental practice. It's a bounded one. If your practice is small, design-led, and happy to run its PHI workflows in a separate tool, Squarespace is defensible. If you want a CMS that leans into local SEO, structured data, and content velocity by default -- without you having to bolt on five plugins to get there -- that's what Supportsheep is built for.`;

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
      "Not in its core website, email, or analytics products. Squarespace's Help Center explicitly states that Acuity Scheduling is the only Squarespace feature currently designed to offer services consistent with HIPAA obligations, and that other parts of the platform, including contact form blocks, cannot be used as part of a HIPAA-compliant solution. A dental practice can still use Squarespace for its public marketing site, but any form or workflow that handles PHI must be routed to a tool that signs a BAA.",
  },
  {
    question: "Does Squarespace sign a Business Associate Agreement (BAA)?",
    answer:
      "Squarespace will sign a BAA for Acuity Scheduling on the Powerhouse or Premium plan, once the account owner enables HIPAA-related features. Squarespace does not sign a BAA for the core website platform, contact form block, email campaigns, member areas, or analytics. If your practice needs HIPAA-aware contact, intake, or messaging, you need a separate vendor (for example Hushmail, Jotform HIPAA, FormDr, or your practice management system's portal) and link to it from Squarespace.",
  },
  {
    question: "What does Squarespace cost for a dental practice in 2026?",
    answer:
      "Squarespace's 2026 website plans, billed annually, are Basic at $16/month, Core at $23/month, Plus at $39/month, and Advanced at $99/month. Most independent practices land on Core for the 0% transaction fee and advanced analytics, or Plus if they need API access and lower payments rates. Acuity Scheduling (if you want HIPAA-aware booking) is a separate subscription; the Powerhouse or Premium tier is required to enable the BAA.",
  },
  {
    question: "Should I use Squarespace or Supportsheep for my dental website?",
    answer:
      "Choose Squarespace if visual polish and a wide template library are the most important factors and you are comfortable wiring up a separate HIPAA-aware booking and intake stack. Choose Supportsheep if you want a free tier with a connected custom domain, a first-class blog with an SEO sidebar and AI drafting, built-in schema (LocalBusiness, Article, FAQPage), and a thin-content guard that blocks shallow pages from being indexed. Supportsheep is a better default for a solo or 2-5 dentist practice that cares more about content velocity and local SEO than about pixel-perfect template design.",
  },
  {
    question: "What HIPAA-compliant booking tools pair well with Squarespace?",
    answer:
      "Acuity Scheduling on the Powerhouse or Premium plan (the BAA-eligible Squarespace product), NexHealth, Dentrix Hub, the patient portal that ships with your practice management system, or a HIPAA-certified form provider like Jotform HIPAA or FormDr. The pattern is the same in every case: keep the marketing site on Squarespace and link out to the booking/intake tool rather than trying to embed PHI-bearing workflows into the core Squarespace site.",
  },
  {
    question: "How hard is it to migrate from Squarespace to Supportsheep?",
    answer:
      "Mechanically straightforward for a small practice site: export the current URL inventory, rebuild the content on Supportsheep, map 301 redirects from the old URL structure to the new one, and flip the domain. The two failure modes to avoid are redirecting everything to the homepage (Google treats that as a soft 404) and redesigning while migrating (it doubles the scope and hides the source of any SEO regression). Most 1-5 dentist practice migrations are a weekend of focused work if you keep design changes for a second phase.",
  },
  {
    question: "Do dental-specific website vendors like Tebra or DearDoc beat Squarespace?",
    answer:
      "They do different jobs. Tebra (formerly PatientPop + Kareo) bundles a website with practice management and patient engagement -- a good fit if you want one vendor for both sides of the business. DearDoc is closer to a lead-generation product built around an AI chat widget and review surfacing. Squarespace is a general-purpose website builder with strong design defaults. For a solo or small practice that wants a credible marketing site and will run PHI workflows in a PMS-native tool, Supportsheep is usually the lowest-overhead pick; Tebra and DearDoc make more sense once the practice is spending real money on patient acquisition.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1500) {
    throw new Error(
      `[pilot:squarespace-for-dentists] content is ${wordCount} words -- below the 1500-word Tier-3 floor`,
    );
  }
  if (wordCount > 2500) {
    throw new Error(
      `[pilot:squarespace-for-dentists] content is ${wordCount} words -- above the 2500-word Tier-3 ceiling`,
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
          "An honest, source-backed look at whether Squarespace is the right website builder for a solo or small dental practice -- and where Supportsheep is the better default.",
        ctaText: "Start your dental practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Dentists",
      },
      title: "Squarespace for dentists: an honest alternative",
      metaDescription:
        "Is Squarespace right for a dental practice? A source-backed comparison covering HIPAA/BAA posture, SEO limits, pricing, and when Supportsheep is the better default.",
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
    `[pilot:squarespace-for-dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/squarespace/for-dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:squarespace-for-dentists] failed:", err);
    process.exit(1);
  });
