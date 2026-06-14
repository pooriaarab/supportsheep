/**
 * Phase 1 pilot: seed `/alternatives/wix/for/lawyers`.
 *
 * Doc id and `variantKey` are both `wix__lawyers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-wix-lawyers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "wix__lawyers";
const VARIANT_KEY = "wix__lawyers";

const CONTENT = `## TL;DR

Wix is a common first website platform for solo attorneys and small law firms -- flexible, fast to launch, and no developer required. It is also widely described as a platform that lawyers "outgrow" once local search competition intensifies or the practice needs deeper intake and CRM integration. This page covers Wix's genuine strengths for a law firm, the real ceilings it hits as SEO stakes rise, and where Supportsheep fits for a solo attorney prioritizing content and local search over visual design freedom.

## Why attorneys actually choose Wix

Wix is genuinely useful for a solo attorney's first professional website, for good reasons:

- **Fast to launch without a developer.** A solo practitioner can have a professional-looking site live in a day. No plugins, no server configuration, no security updates.
- **Drag-and-drop control for brand expression.** Wix gives more pixel-level layout control than Squarespace. A sole practitioner who wants to build a specific visual identity -- distinctive header treatment, custom testimonial layouts, specific font pairings -- can implement it without CSS.
- **Built-in appointment scheduling.** Wix Bookings lets visitors schedule an initial consultation directly from the site. For a solo attorney doing free 30-minute consultations as a lead-conversion tool, this removes a friction point.
- **Large app ecosystem.** Live chat (for immediate response to site visitors), review widgets, Mailchimp or Klaviyo for follow-up email sequences, Google Ads conversion tracking -- these integrate cleanly through the Wix App Market.
- **Improving SEO basics.** Wix earned a poor SEO reputation years ago. That reputation is now outdated: Wix supports title tags, meta descriptions, image alt text, XML sitemaps, clean URLs, and basic schema. For a new solo practice targeting low-competition local queries, Wix's SEO tooling is adequate.

## Where Wix breaks down for lawyers

### The SEO ceiling that legal-marketing agencies keep describing

Multiple legal marketing agencies and SEO consultants characterize Wix as a "get online fast" platform rather than a long-game SEO foundation. The specific limitations for attorneys:

- **Heading structure is constrained.** Most Wix templates limit heading choices in ways that make it harder to maintain clean H1/H2/H3 hierarchy across a complex site without workarounds.
- **LegalService and Attorney schema requires manual injection.** Google's rich results for legal services benefit from LegalService, Attorney (a Person subtype), and LocalBusiness schema markup. Adding these on Wix requires a custom code block injection -- it is not automated. Supportsheep ships this by default.
- **Programmatic local SEO pages are hand-built.** A solo attorney serving multiple neighborhoods or practice areas benefits from a dedicated page per combination ("estate planning attorney [neighborhood]," "DUI lawyer [county]"). Building these at any scale on Wix is hand labor -- there is no templating engine.
- **Redirect management for site migrations is painful.** Attorneys who outgrow Wix and migrate to WordPress or a dedicated legal platform find Wix's redirect tooling cumbersome at scale.

The industry consensus from legal-marketing specialists: Wix works well at launch when local search competition is low. Once the practice is trying to rank for competitive metropolitan keywords against law firms with dedicated SEO investments, Wix's platform becomes a constraint.

### Intake forms and client confidentiality

The same boundary applies here as on any general-purpose website builder: Wix's native contact and form tools are not designed for privileged attorney-client communications. The practical guidance:

- A basic "name, email, brief matter description" form with appropriate disclaimer language (no attorney-client relationship until engagement letter is signed) is common on Wix and generally defensible.
- Detailed case intake -- facts of the matter, prior legal history, financial information, documents -- belongs in a purpose-built legal CRM tool (Clio Grow, Lawmatics, MyCase) that maintains appropriate security, access controls, and confidentiality standards.
- Do not treat Wix's form storage as a document repository for matter-sensitive information. Route substantive intake to your legal CRM.

### The "outgrowth problem" is documented

Legal marketing agencies routinely describe a pattern: a solo attorney launches on Wix for simplicity, builds a practice, then faces a migration when the SEO limitations become binding. The migration itself is a project -- exporting content, mapping redirects, rebuilding structure -- that is manageable but real. If you're planning a five-year investment in local SEO authority, building on a platform you don't expect to outgrow is worth the upfront decision.

## Intake and CRM tools that pair with Wix for attorneys

- **Clio Grow** -- intake CRM from Clio (market-leading legal practice management platform); handles lead intake, conflict checks, and e-signature for retainers. Embeds as an intake form or links from the Wix contact page.
- **Lawmatics** -- intake automation with automated lead follow-up sequences; strong for practices with high consultation volume.
- **MyCase** -- full practice-management platform with a client portal and intake module.
- **PracticePanther** -- competitive to MyCase; clean intake and document management.
- **Calendly** -- for scheduling initial consultations without clinical-data complexity; link from the Wix contact page.

The pattern: Wix is the marketing layer; the legal CRM is the intake and matter layer. They connect via a link or an embed on the contact page.

## Supportsheep's position for a solo or small law firm

Supportsheep is designed for the "solo professional service business that wants a credible, content-led marketing site with minimal overhead." For a solo attorney:

- **Free tier with custom domain.** A solo attorney launching a new practice can build and iterate on the marketing site before paying. Wix's free tier shows Wix branding -- not appropriate for a real practice.
- **Blog with SEO sidebar and AI-assisted drafting.** Content marketing for attorneys ("what is a power of attorney in [state]," "what happens at a preliminary hearing in [city]," "how long does a chapter 7 bankruptcy take") is the highest-ROI acquisition channel for a solo practice that cannot afford PPC or a legal marketing agency. Supportsheep's blog surfaces title/meta audits, internal link suggestions, and FAQPage JSON-LD inline.
- **LegalService and LocalBusiness schema by default.** Structured data for a law firm -- practice area, address, phone, attorney Person schema -- ships without a code block injection. This is a material difference for a practice investing in local search.
- **Correct architectural expectation.** Supportsheep is a marketing site builder, not a legal CRM. The expected architecture -- marketing site on Supportsheep, intake and matter management in Clio Grow, Lawmatics, or MyCase -- is what legal-marketing agencies recommend as a baseline. It is baked into Supportsheep's design rather than left to the user to discover after a form-data incident.

## Side-by-side: Wix vs Supportsheep for law firms

<table>
<thead>
<tr><th>Feature</th><th>Wix (Core / Business)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$29/mo (Core) -- $36/mo (Business)</td><td>Free tier with custom domain</td></tr>
<tr><td>Editor flexibility</td><td>High -- drag-and-drop pixel control; good for distinctive brand expression</td><td>Lower -- AI-guided layouts; constrained by design but consistent</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; adequate basic SEO; schema requires manual addition</td><td>Blog with SEO sidebar, AI drafting, LegalService + LocalBusiness schema by default</td></tr>
<tr><td>Intake forms for client intake</td><td>Not suitable for privileged matter detail -- link to Clio Grow, Lawmatics, or MyCase</td><td>Same -- link to legal CRM; do not collect matter detail in the CMS</td></tr>
<tr><td>Built-in scheduling</td><td>Wix Bookings for initial consultations; not suitable for clinical intake</td><td>Link to Calendly, Clio Grow, or Lawmatics intake scheduler</td></tr>
<tr><td>Long-term SEO ceiling</td><td>Lower than WordPress; adequate for low-competition local markets at launch</td><td>Higher automated schema output; content-velocity tooling; better for search-first practices</td></tr>
<tr><td>Best fit</td><td>Attorneys who prioritize design freedom and fast launch; plan to address SEO ceiling later</td><td>Supportsheep attorneys prioritizing content velocity and local SEO from day one, with lower monthly cost</td></tr>
</tbody>
</table>

## Practical checklist for a solo attorney evaluating Wix vs Supportsheep

1. **What is your local search competition level?** If you are launching a solo practice in a major metro competing against law firms with dedicated SEO spend, starting on a platform with higher automated schema and content tooling (Supportsheep, or WordPress with Yoast) avoids a migration 18 months from now.
2. **How design-sensitive is your brand?** Wix wins if pixel-level layout control is the deciding factor. Supportsheep wins if content consistency and SEO automation are.
3. **What's your intake workflow?** Both platforms assume a legal CRM for matter intake. Choose your legal CRM first; it determines your intake architecture independent of the marketing site.
4. **What's your budget for the first year?** Supportsheep's free tier plus Pro at {{solo.pro.yearly}} billed annually is a different cost profile than Wix Core at $29/month plus the app stack that a full-featured legal site typically needs.
5. **Do you blog?** If you plan to publish monthly legal explainer content, a CMS with an SEO sidebar and AI drafting (Supportsheep) reduces the time-per-post compared to a CMS without it.`;

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
    question: "Is Wix good for a law firm website?",
    answer:
      "Yes, for a solo attorney or small firm that wants to launch fast without developer involvement and whose local search competition is moderate. Wix's drag-and-drop editor offers more layout control than Squarespace, its built-in Bookings tool handles initial consultation scheduling, and its SEO basics (titles, meta, sitemap) are adequate for low-competition local queries. The ceilings appear when the practice needs programmatic local-SEO pages, automated LegalService schema, or deeper intake integration -- legal marketing agencies consistently describe Wix as a platform attorneys outgrow once SEO stakes rise.",
  },
  {
    question: "Can a law firm use Wix's forms for client intake?",
    answer:
      "For basic lead capture (name, email, brief matter description with a disclaimer) yes. For substantive case intake -- facts of the matter, financial information, case history, documents -- no. Use a legal CRM tool (Clio Grow, Lawmatics, MyCase) for matter intake; these are purpose-built for attorney-client confidentiality. The Wix site handles the marketing layer; the legal CRM handles the intake and matter layer.",
  },
  {
    question: "Should I use Wix or Supportsheep for my law firm website?",
    answer:
      "Choose Wix if design freedom and editor flexibility are the highest priority, or if you want built-in appointment booking through Wix Bookings without a separate scheduling link. Choose Supportsheep if you want LegalService and LocalBusiness schema automated by default (no code injection required), a blog with an SEO sidebar and AI drafting for content marketing, a free tier with a custom domain at launch, and lower monthly cost at the Pro tier ({{solo.pro.yearly}} annually). Both platforms require the same intake architecture: legal CRM for matter intake, not CMS forms.",
  },
  {
    question: "What are the SEO limitations of Wix for attorneys?",
    answer:
      "Wix covers the basics (titles, meta, sitemaps, clean URLs) but has a lower ceiling than WordPress for competitive legal SEO: LegalService and Attorney schema require manual code injection, programmatic local-SEO page generation is not supported, heading-structure customization is constrained, and redirect management for larger sites is cumbersome. Legal marketing agencies consistently recommend that practices targeting competitive metro keywords move to a platform with more automated schema and content tooling after Wix's limitations become binding.",
  },
  {
    question: "What scheduling tools work with a Wix law firm website?",
    answer:
      "Wix Bookings (built-in) for initial consultations where no PHI is collected, Calendly (link or embed) for simple consultation scheduling, Clio Grow's intake scheduler for practices using the Clio ecosystem, and Lawmatics for practices that want automated intake-to-matter workflows. The pattern: link or embed your scheduler on the contact page; do not attempt to route substantive matter intake through the CMS.",
  },
  {
    question: "How do solo attorneys use content marketing for SEO?",
    answer:
      "Content marketing for attorneys centers on evergreen legal explainer content: what a power of attorney does, how Chapter 7 bankruptcy works, what to do after a car accident in [state]. These posts answer informational queries that prospects search before hiring counsel, build topical authority, and compound into local search rankings over 12-18 months. Supportsheep's blog ships with FAQPage JSON-LD on Q&A content, LegalService schema, and an SEO sidebar that audits titles and meta descriptions inline -- reducing the per-post time for a solo practitioner doing content marketing without an agency.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:wix-for-lawyers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:wix-for-lawyers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Wix for solo attorneys and small law firms -- covering its real strengths at launch, the SEO ceiling it hits as competition grows, and when Supportsheep is the better default.",
        ctaText: "Start your law firm website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Lawyers",
      },
      title: "Wix for lawyers: an honest alternative",
      metaDescription:
        "Is Wix right for a law firm website? An honest comparison covering editor flexibility, SEO ceiling, intake form limits, and when Supportsheep is the better default for content-first practices.",
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
    `[pilot:wix-for-lawyers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/wix/for/lawyers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:wix-for-lawyers] failed:", err);
    process.exit(1);
  });
