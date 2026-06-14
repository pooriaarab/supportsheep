/**
 * Phase 1 pilot: seed `/alternatives/squarespace/for/lawyers`.
 *
 * Doc id and `variantKey` are both `squarespace__lawyers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-squarespace-lawyers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "squarespace__lawyers";
const VARIANT_KEY = "squarespace__lawyers";

const CONTENT = `## TL;DR

Squarespace is a reasonable starting point for a solo attorney or small law firm that needs a professional web presence fast. Its templates are genuinely polished, it handles hosting, SSL, and domains in one bill, and it requires no developer involvement. The ceilings arrive when the practice grows: Squarespace's SEO customization surface is shallow compared to WordPress, its form blocks cannot collect confidential client information compliantly, and its integration ecosystem lacks the depth legal-specific intake, CRM, and scheduling tools require. This page covers the honest trade-offs and explains when Supportsheep is a better default for a solo or boutique firm.

## Does a law firm actually need a custom website?

A law firm's website does one job: convert a searcher looking for legal help into a consultation. That conversion path is usually simple -- search "[practice area] attorney [city]" → land on a page that signals expertise and trust → read bio and reviews → submit a contact form or call. The site doesn't need to be complicated. It needs to be credible, fast, locally optimized, and findable.

Squarespace clears that bar for many solo and small-firm practitioners. The question is whether it clears it for the next two to five years, not just launch day.

## Squarespace's strengths for attorneys

- **Template quality.** The Squarespace template library has a higher design floor than almost any other general-purpose builder. A solo attorney can pick a professional-looking template, customize colors and typography, and launch a credible-looking site in a day. That matters: trust signals are load-bearing in legal search conversion.
- **Ease of management.** No plugins, no security updates, no server maintenance. An attorney who wants to update their bio or add a new practice area page can do it without calling a developer.
- **Built-in blog.** A law firm blog for "evergreen explainer" content -- what is a power of attorney, what happens at a criminal arraignment, what does a personal injury contingency fee mean -- is a real local SEO asset. Squarespace's blog is adequate for this; it's not a dedicated content platform, but for one to four posts per month it works.
- **Responsive by default.** Templates are mobile-first. Google's mobile-first indexing doesn't penalize a default Squarespace site.

## Where Squarespace breaks down for lawyers

### SEO ceiling

Legal search is competitive. Practice-area + city keyword combinations ("estate planning attorney Denver," "DUI lawyer Houston") have real search volume and real competitive pressure. Legal SEO agencies consistently flag Squarespace's customization surface as shallow:

- Heading support is limited (H1-H3 only in most templates without custom CSS).
- Programmatic local-SEO pages (one page per neighborhood + practice area, with consistent structured data) are hand-built one at a time -- there is no templating or batch generation.
- Granular redirect management requires workarounds.
- LegalService and Attorney schema markup requires a custom code block injection, not an automated CMS workflow.

For a solo attorney doing general estate work in a small city, these ceilings may not matter. For a three-to-ten attorney firm targeting competitive keywords in a metro market, the platform becomes a constraint after 12-18 months.

### Client intake forms and attorney-client privilege

Squarespace's contact form block is not suitable for collecting detailed case information that could establish or suggest an attorney-client relationship. Reasons:

- Squarespace does not encrypt form submissions end-to-end.
- Squarespace does not sign a data-processing agreement suitable for legal confidentiality purposes.
- Form submissions flow through Squarespace's servers and can be accessed by Squarespace staff.

The standard pattern is: keep the public marketing site on Squarespace (practice area descriptions, attorney bios, FAQ, blog), and use a separate, secure intake tool (Clio Grow, Lawmatics, MyCase, SmokeBall) for actual case intake. The Squarespace form can collect "name, email, brief description of your matter" with appropriate disclaimer language; anything that goes deeper should go into a dedicated legal CRM intake flow.

### Integration depth

Legal-specific workflows -- calendared conflict checks, court date tracking, trust accounting, e-signature for retainers, document management -- live outside any general-purpose website builder. Squarespace's integration ecosystem does not directly support these; you wire them via Zapier or handle them in a completely separate legal practice management system (Clio, MyCase, PracticePanther, CosmoLex). That is fine as long as you plan for it -- but the gap between "I have a Squarespace site" and "I have a functioning client-intake-to-matter workflow" is significant.

### ADA compliance risk

Squarespace has limited accessibility controls compared to a fully developer-controlled platform. Law firms are actually at higher risk of ADA Title III website-accessibility lawsuits than most service businesses, and Squarespace templates are not certified WCAG 2.1 AA compliant out of the box. This is not unique to Squarespace -- WordPress without an accessibility plugin has the same problem -- but it is worth noting for a practice type whose own clients are sometimes disabled individuals.

## Supportsheep's position for a solo or boutique attorney

Supportsheep is designed for the "1-5 person professional service business that needs a credible marketing site without becoming a part-time webmaster." For a solo attorney:

- **Free tier with custom domain.** A solo attorney launching a new practice can launch a branded site on Supportsheep's free tier while the matter pipeline is still being built. Squarespace requires a paid plan once the 14-day trial ends.
- **Blog with SEO sidebar and AI drafting.** Supportsheep's blog is built around content velocity: title/meta audits, internal link suggestions, FAQPage JSON-LD for FAQ content. An attorney who wants to write monthly explainer posts benefits from a CMS that surfaces SEO signals inline rather than leaving them for later.
- **LegalService and LocalBusiness schema by default.** Structured data for a local law firm (practice area, address, phone, attorney Person schema) ships without a plugin or a code block injection.
- **No client intake in the CMS, by design.** Supportsheep is a marketing site builder, not a legal CRM. The correct split -- marketing site on Supportsheep, case intake on Clio Grow, Lawmatics, or MyCase -- is the same architecture most legal-marketing agencies recommend. That keeps privileged information out of a general-purpose CMS entirely.

## Side-by-side: Squarespace vs Supportsheep for a law firm

<table>
<thead>
<tr><th>Feature</th><th>Squarespace (Basic / Core / Plus)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$16/mo (Basic) -- $39/mo (Plus)</td><td>Free tier with custom domain</td></tr>
<tr><td>Template depth and design quality</td><td>Award-winning; design-first; best-in-class polish</td><td>Opinionated defaults tuned for content; less template choice, more content focus</td></tr>
<tr><td>Blog and content SEO</td><td>Built-in blog; titles, meta, sitemap; H1-H3 headings; limited schema</td><td>Blog with SEO sidebar, AI drafting, LegalService + LocalBusiness schema by default</td></tr>
<tr><td>Intake forms</td><td>Form block not suitable for confidential case detail -- use a legal CRM intake tool</td><td>Same -- link to Clio Grow, Lawmatics, or MyCase; do not collect case detail in the CMS</td></tr>
<tr><td>Integration ecosystem</td><td>Zapier for legal tools; no native legal-CRM integration</td><td>Zapier or direct link-out; same pattern as Squarespace</td></tr>
<tr><td>Best fit</td><td>Design-led solo or small firms that prioritize visual polish and will build a separate intake stack</td><td>Solo or boutique firms prioritizing content velocity, local SEO, and low overhead</td></tr>
</tbody>
</table>

## Legal intake tools that pair well with Squarespace or Supportsheep

- **Clio Grow** -- intake CRM from Clio; collects lead and matter details, runs conflict checks, handles e-signature for retainers. Works as the intake layer behind either CMS.
- **Lawmatics** -- legal CRM and intake automation; strong on automated follow-up sequences for leads who don't convert immediately.
- **MyCase** -- full practice-management platform with a client portal and intake forms.
- **PracticePanther** -- competitive to MyCase; pairs well with smaller firms.
- **Calendly** -- for scheduling initial consultations; link from your Squarespace or Supportsheep contact page to a Calendly booking page.

## A practical launch checklist for a solo attorney's website

1. **Decide your practice areas.** Create one page per distinct practice area -- estate planning, business formation, family law, etc. Don't combine them. Each page targets distinct keyword clusters and signals topical authority to search engines.
2. **Write an attorney bio that converts.** Bar number, law school, years in practice, notable outcomes (where rules permit), and a clear statement of who you serve. This is the most-visited page on most attorney sites.
3. **Claim and optimize your Google Business Profile.** A local map-pack result drives more calls than organic results for many solo attorneys. This is separate from but complementary to your website.
4. **Set up LegalService and LocalBusiness structured data.** Google's rich results for legal services are modest but real. Get the schema right at launch rather than retrofitting.
5. **Route intake to a legal CRM, not a CMS form.** The Squarespace or Supportsheep contact page should say "tell us a bit about your matter" with a disclaimer, then hand off to Clio Grow, Lawmatics, or your preferred intake tool.
6. **Start a blog with a publication cadence you can sustain.** One post per month that answers a real question your clients ask ("how long does probate take in [state]?") compounds into real search traffic within 12-18 months.`;

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
    question: "Is Squarespace good for a law firm website?",
    answer:
      "Yes, for a solo or small firm that wants a professional-looking site fast without developer involvement. Squarespace's template library is best-in-class for visual polish, and it handles hosting, SSL, and domains in one bill. The limitations surface at the SEO ceiling (heading depth is capped, programmatic local pages are hand-built, granular schema requires custom code) and at the intake boundary (Squarespace form blocks are not appropriate for collecting confidential case detail -- route intake to Clio Grow, Lawmatics, or MyCase instead).",
  },
  {
    question: "Can a law firm use Squarespace forms for client intake?",
    answer:
      "With caution. A simple 'name, email, brief matter description' form with appropriate disclaimer language (no attorney-client relationship until engagement) is common. What you should not collect through a Squarespace form block: privileged case details, financial information, medical records, or anything whose confidentiality is legally protected. For substantive intake -- the information that starts the conflict check and the matter file -- use a legal CRM tool (Clio Grow, Lawmatics, MyCase) that stores data in a system designed for attorney-client confidentiality.",
  },
  {
    question: "What SEO limitations does Squarespace have for attorneys?",
    answer:
      "Squarespace supports the basics: title tags, meta descriptions, image alt text, sitemap, and clean URLs. It lacks depth for competitive legal SEO: heading support stops at H3 in most templates, LegalService and Attorney schema markup requires a custom code block injection rather than automated CMS output, programmatic local-SEO pages (one page per neighborhood + practice area) must be hand-built, and redirect management for larger sites is cumbersome. Supportsheep automates LegalService and LocalBusiness schema by default and is designed around content velocity, which is the realistic lever for a solo attorney's SEO strategy.",
  },
  {
    question: "Should I use Squarespace or Supportsheep for my law firm website?",
    answer:
      "Choose Squarespace if visual design quality and template variety are the most important factors for your practice brand, and if you're comfortable building a separate legal intake stack (Clio Grow, Lawmatics). Choose Supportsheep if you want a free tier with a custom domain at launch, a blog with an SEO sidebar and AI-assisted drafting, and structured data (LegalService, LocalBusiness, FAQPage) built in rather than bolted on. Both platforms require the same architectural discipline: marketing site in the CMS, privileged intake in a legal CRM.",
  },
  {
    question: "What legal CRM tools work with Squarespace and Supportsheep?",
    answer:
      "Clio Grow (intake CRM from Clio, the market-leading legal PM platform), Lawmatics (intake automation with strong follow-up sequences), MyCase (full practice management with client portal), PracticePanther, and SmokeBall. All of these handle intake forms, conflict checks, e-signature for retainers, and matter management in a purpose-built tool. They link from your website's contact page -- you don't embed confidential intake inside Squarespace or Supportsheep.",
  },
  {
    question: "How does local SEO work for solo attorneys?",
    answer:
      "Local SEO for a solo attorney has three layers: (1) Google Business Profile -- claim it, fill every field, collect reviews, post updates; map-pack results drive more calls than organic blue-links for many local legal queries. (2) On-site practice-area pages -- one page per distinct area, each targeting a '[practice area] attorney [city]' cluster with clear structured data. (3) Content -- blog posts answering specific questions your clients ask, building topical authority and capturing informational queries that precede a hire decision. Supportsheep's blog with SEO sidebar and automated FAQPage schema is designed for exactly this content-compounding approach.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:squarespace-for-lawyers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:squarespace-for-lawyers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Squarespace for solo attorneys and small law firms -- covering SEO ceiling, intake form limits, and when Supportsheep is the better default for content and local search.",
        ctaText: "Start your law firm website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Lawyers",
      },
      title: "Squarespace for lawyers: an honest alternative",
      metaDescription:
        "Is Squarespace right for a law firm? An honest comparison covering SEO limits, intake form risks, legal CRM integration, and when Supportsheep is the better default.",
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
    `[pilot:squarespace-for-lawyers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/squarespace/for/lawyers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:squarespace-for-lawyers] failed:", err);
    process.exit(1);
  });
