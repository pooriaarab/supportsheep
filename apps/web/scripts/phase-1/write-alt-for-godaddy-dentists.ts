/**
 * Phase 1 pilot: seed `/alternatives/godaddy/for/dentists`.
 *
 * Doc id and `variantKey` are both `godaddy__dentists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-godaddy-dentists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "godaddy__dentists";
const VARIANT_KEY = "godaddy__dentists";

const CONTENT = `## TL;DR

GoDaddy is one of the world's largest domain registrars and offers an AI-assisted website builder marketed as a fast way for small businesses -- including dental practices -- to get online. For a dental practice, the critical limitation is clear and well-documented: GoDaddy does not sign a Business Associate Agreement (BAA) for its website builder, hosting, or standard web services. Only GoDaddy's Microsoft 365 email integration has any HIPAA posture, and even that is limited to email only. A dental practice can use GoDaddy to build a public marketing site, but every patient-data touchpoint must go to a dedicated HIPAA-aware tool. This page covers that honestly and compares GoDaddy to Supportsheep for a solo or small practice.

## GoDaddy and HIPAA: the honest summary

GoDaddy does not sign a Business Associate Agreement for its website builder, website hosting, contact forms, analytics, or standard products. Multiple HIPAA compliance authorities (HIPAA Journal, LuxSci, Compliancy Group, AccountableHQ) reach the same conclusion: GoDaddy's web infrastructure is not HIPAA-compliant and is not suitable for collecting, storing, or transmitting PHI through websites.

The single carve-out is Microsoft 365 email through GoDaddy's reseller program: certain Business Professional and Premium Security M365 accounts through GoDaddy can be used for HIPAA-compliant email. That is email only -- it does not extend to the website, forms, or hosting.

For a dental practice, the practical implication is the same as for Squarespace (which also has no BAA on its core platform): use GoDaddy for the public marketing site (homepage, services, team, location, blog), and route all PHI-touching workflows -- online appointment booking, patient intake forms, insurance pre-authorization, recall reminders -- to a HIPAA-aware tool that signs a BAA.

## GoDaddy's AI website builder: what it actually does

GoDaddy's website builder uses AI to accelerate setup. You enter your business type and a short description, and the AI generates a starter site with relevant sections, suggested copy, and service descriptions. The resulting site is editable in a point-and-click interface with no code required.

For a solo dentist or small practice, this is genuinely useful: the AI-generated starter reduces the blank-canvas problem and gets you to a usable first draft quickly. The trade-offs are:

- **Limited design customization.** GoDaddy's builder is simpler than Squarespace or Wix. You can change content, colors, and basic layouts, but deep visual customization is not the product's strength.
- **Shallow SEO controls.** GoDaddy's builder handles basic SEO (title tags, meta descriptions, XML sitemaps), but schema injection, programmatic local-SEO pages, and advanced redirect management are not native. Dental SEO agencies note that GoDaddy's SEO ceiling is lower than WordPress and comparable to -- or slightly below -- Squarespace and Wix.
- **Integration ecosystem is limited.** GoDaddy's app market is smaller than Wix's and less capable than WordPress's. Dental-specific tools (NexHealth, Dentrix, practice management system portals) typically link from the site rather than integrating natively.

## Where GoDaddy works for a dental practice

**Speed to a first draft.** GoDaddy's AI builder is fast. A solo dentist who needs a basic website before opening a new practice can generate a usable starter in under an hour, then refine it over a week. That matters when the alternative is an empty placeholder page or an expensive agency retainer.

**Domain + hosting + email in one place.** GoDaddy's core business is domain registration and hosting. A practice that buys its domain from GoDaddy can keep the domain, hosting, and professional email on one account -- one login, one support number, one bill. That simplicity has value for a practice owner who does not have an IT person.

**Familiar brand.** GoDaddy is recognizable, which reduces the friction of explaining vendor choices to an office manager or accountant. It is not a startup, and its support infrastructure is substantial.

## Where GoDaddy breaks down for dental practices

**No BAA -- period.** Unlike Wix (which added HIPAA mode in 2026) and Acuity (which has been BAA-eligible for years), GoDaddy has no path to a BAA for its website builder or hosting. This is not a future roadmap item -- it is a fundamental architectural choice about what GoDaddy is. Plan for 100% of your PHI workflow to live outside GoDaddy.

**SEO ceiling is real for local dental search.** Competitive dental keywords ("invisalign dentist [city]," "sedation dentistry [metro area]," "pediatric dentist near me") have real PPC and organic competition. GoDaddy's builder lacks the schema automation and programmatic-page tooling that a serious local SEO strategy needs. Most dental practices that grow beyond 3-5 operatories and start competing seriously for location-based keywords eventually migrate off GoDaddy.

**Limited content platform.** A dental blog for patient education and local SEO ("how often should you get a dental cleaning," "what is a crown vs a veneer," "[city] emergency dentist") is one of the highest-ROI marketing investments for a solo or small practice. GoDaddy's blog is basic -- adequate for a few posts, not designed for a serious content velocity strategy.

**Design quality floor is lower.** GoDaddy's templates are functional but not design-forward. In a competitive local market where a practice's website is a trust signal, GoDaddy's design ceiling is below Squarespace's and Wix's.

## Supportsheep's position for a solo or small dental practice

Supportsheep is designed for the "solo or 2-5 practitioner service business that needs a credible marketing site and a content-driven approach to local SEO." For a solo dentist evaluating GoDaddy:

- **Free tier with custom domain.** A dentist building a new practice site can attach their existing domain to Supportsheep without paying until they're ready. GoDaddy's domain is paid; its website builder is additional.
- **AI-generated first draft from a business description.** Supportsheep's onboarding generates a usable first draft from a business prompt -- service descriptions, homepage sections, copy -- without a blank canvas. This is comparable to GoDaddy's AI builder, but the resulting site is built on a content-and-SEO-first architecture.
- **Blog with SEO sidebar, AI drafting, and structured data.** Supportsheep's blog emits FAQPage JSON-LD, Article schema, and LocalBusiness schema by default. A dentist who writes a post on "what to expect at a dental cleaning" gets structured data automatically, not after a plugin install.
- **No PHI complexity.** Supportsheep does not handle PHI and does not offer a BAA. The correct architecture -- marketing site on Supportsheep + HIPAA-aware booking and intake tools (NexHealth, Dentrix Hub, Acuity Premium, or your PMS portal) -- is the same architecture a GoDaddy-based practice should use. The difference is that Supportsheep's content machinery compounds into local search authority over 12-18 months in a way that GoDaddy's builder typically does not.

## Side-by-side: GoDaddy vs Supportsheep for a dental practice

<table>
<thead>
<tr><th>Feature</th><th>GoDaddy Website Builder</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>AI site generation</td><td>Yes -- AI-assisted setup from business description</td><td>Yes -- AI-guided onboarding generates multi-page first draft</td></tr>
<tr><td>Starting price</td><td>Paid plans required for a real practice site; typically $10-$25/mo</td><td>Free tier with custom domain</td></tr>
<tr><td>HIPAA BAA</td><td>No -- GoDaddy does not sign a BAA for website builder or hosting</td><td>Not applicable -- Supportsheep does not handle PHI; link to NexHealth, Acuity Premium, or PMS portal</td></tr>
<tr><td>Blog and SEO tooling</td><td>Basic blog; title and meta fields; no automated schema</td><td>Blog with SEO sidebar, AI drafting, Dentist + LocalBusiness + FAQPage schema by default</td></tr>
<tr><td>Design quality</td><td>Functional; below Squarespace and Wix design floor</td><td>Opinionated layouts tuned for content; consistent but constrained</td></tr>
<tr><td>Domain and hosting bundling</td><td>Strong -- GoDaddy's core product; domain + hosting + email in one</td><td>Managed hosting with custom domain; GoDaddy can still hold the domain registration</td></tr>
<tr><td>Best fit</td><td>Practices that already buy from GoDaddy and want a fast no-code site without switching vendors</td><td>Supportsheep / 2-5 dentist practices focused on content velocity, local SEO, and low overhead</td></tr>
</tbody>
</table>

## HIPAA-aware tools that pair with GoDaddy or Supportsheep for dental practices

Since GoDaddy cannot be configured for PHI handling (and Supportsheep intentionally stays out of PHI territory), both platforms require the same supplemental stack for clinical workflow:

- **NexHealth** -- patient engagement platform: HIPAA-compliant online booking, intake forms, appointment reminders, two-way texting. Signs a BAA.
- **Dentrix Hub / Dentrix Patient Engage** -- patient communication and scheduling from a leading dental practice management platform.
- **Acuity Scheduling (Premium plan)** -- BAA-eligible scheduling for practices that want a standalone scheduler rather than a full PMS integration.
- **Zocdoc** -- patient acquisition and scheduling marketplace; handles HIPAA-compliant booking and can supplement direct-traffic from the GoDaddy or Supportsheep marketing site.
- **Your PMS's native patient portal** -- Eaglesoft, Curve Dental, Open Dental, and most practice management systems ship a patient portal that handles booking, intake, and recall natively and signs a BAA.

## Getting started: practical steps for a dentist choosing GoDaddy or Supportsheep

1. **Buy your domain first.** GoDaddy is a strong domain registrar. Buy the domain from GoDaddy regardless of which website builder you choose -- you can point it at Supportsheep or any other host.
2. **Choose your PHI workflow before choosing your website builder.** Pick your practice management system and patient portal first. Those tools are your HIPAA compliance layer; the website is just the marketing surface.
3. **Generate a first draft.** Both GoDaddy's AI builder and Supportsheep's AI onboarding get you to a usable first draft quickly. Test both -- Supportsheep's free tier makes it zero-cost to compare.
4. **Prioritize content from day one.** Four to six blog posts per year on local patient-education topics compounded over 18 months is worth more in local search than any technical SEO setting in either builder. Commit to a content rhythm regardless of platform choice.
5. **Plan your migration path.** If you start on GoDaddy and expect to outgrow it, keep your content in portable formats (clean HTML, exported images) and document your URL structure from day one. Migration is easier when the URL map is clean.`;

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
    question: "Is GoDaddy HIPAA compliant for a dental practice?",
    answer:
      "No. GoDaddy does not sign a Business Associate Agreement for its website builder, web hosting, or contact forms. The company's own documentation and HIPAA compliance authorities consistently confirm that GoDaddy's standard web products cannot be used to collect, store, or transmit PHI. The single exception is certain Microsoft 365 email plans through GoDaddy, which can support HIPAA-compliant email only -- not websites or forms. A dental practice using GoDaddy must route all PHI-touching workflows to a dedicated HIPAA-aware tool (NexHealth, Dentrix, Acuity Premium, or the practice management system's patient portal).",
  },
  {
    question: "Can I use GoDaddy website builder for my dental practice?",
    answer:
      "Yes, for the public marketing layer -- homepage, services, team, location, FAQ, blog. GoDaddy's AI website builder generates a usable first draft quickly and keeps domain, hosting, and email on one account. The constraints are: no HIPAA BAA for any web-related GoDaddy product; a lower SEO ceiling than Squarespace or Wix for competitive local dental keywords; a basic blog not designed for content velocity; and design quality below Squarespace's template floor. For a new practice that wants to get online fast and already uses GoDaddy for its domain, the builder is a defensible starting point with a clear migration path.",
  },
  {
    question: "Should I use GoDaddy or Supportsheep for my dental practice website?",
    answer:
      "Choose GoDaddy if you already buy your domain and hosting from GoDaddy, want everything on one account, and need to launch fast with minimal decisions. Choose Supportsheep if you want a free tier with a custom domain, AI-guided onboarding that generates a multi-page first draft, a blog with an SEO sidebar and AI drafting, and Dentist and LocalBusiness schema shipped by default rather than added via code injection. Both platforms require the same HIPAA discipline: marketing site on the CMS, PHI-handling in a dedicated clinical tool (NexHealth, Acuity Premium, PMS portal).",
  },
  {
    question: "What are the SEO limitations of GoDaddy's website builder for dentists?",
    answer:
      "GoDaddy's website builder handles the basics (title tags, meta descriptions, XML sitemaps, mobile-responsive templates) but lacks the depth that competitive dental SEO requires: Dentist and LocalBusiness schema are not automated, programmatic local-SEO pages (one per location or service area) must be hand-built, and heading-structure control is limited. Supportsheep automates Dentist, LocalBusiness, FAQPage, and Article schema by default and is designed around content velocity for local service businesses. For a new practice in a low-competition market, GoDaddy's SEO basics may be enough; for a growing practice targeting competitive metropolitan keywords, the ceiling becomes binding.",
  },
  {
    question: "What does a dental practice website need to rank in local search?",
    answer:
      "Local search ranking for dental practices depends on: (1) Google Business Profile -- claim and fully optimize with services, hours, photos, and patient reviews; (2) on-site service pages with Dentist schema and location-specific content; (3) a blog with patient-education content that targets informational queries ('what is a root canal,' 'how to prevent cavities'); (4) LocalBusiness and Dentist JSON-LD schema on the practice page; (5) consistent NAP (name, address, phone) across the web. Supportsheep ships Dentist and LocalBusiness schema automatically. GoDaddy requires manual schema injection or a plugin for these signals.",
  },
  {
    question: "How does GoDaddy compare to Wix and Squarespace for a dental practice?",
    answer:
      "All three are general-purpose website builders with no HIPAA BAA on their core platforms (Wix is the exception -- it added HIPAA mode on Business and higher plans in 2026). GoDaddy differentiates on domain-and-hosting bundling and fast AI setup, but trails Squarespace on design quality and Wix on editor flexibility and app ecosystem. For a dental practice where the marketing site is the main use case and PHI lives in a separate HIPAA-aware tool, GoDaddy is the fastest path to a live site if you're already a GoDaddy customer. Squarespace or Supportsheep are the better defaults if design quality (Squarespace) or content velocity and local SEO (Supportsheep) are the priority.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:godaddy-for-dentists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:godaddy-for-dentists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at GoDaddy's website builder for solo and small dental practices -- including its firm no-BAA position, SEO ceiling, and when Supportsheep is the better default for content and local search.",
        ctaText: "Start your dental practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Dentists",
      },
      title: "GoDaddy for dentists: an honest alternative",
      metaDescription:
        "Is GoDaddy right for a dental practice website? An honest comparison covering HIPAA/BAA posture, AI site generation, SEO limits, and when Supportsheep is the better default.",
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
    `[pilot:godaddy-for-dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/godaddy/for/dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:godaddy-for-dentists] failed:", err);
    process.exit(1);
  });
