/**
 * Phase 1 pilot: seed `/alternatives/godaddy/for/therapists`.
 *
 * Doc id and `variantKey` are both `godaddy__therapists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-godaddy-therapists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "godaddy__therapists";
const VARIANT_KEY = "godaddy__therapists";

const CONTENT = `## TL;DR

GoDaddy is a fast, low-friction way for a solo therapist to get a professional-looking practice website online -- especially if they already buy their domain and hosting from GoDaddy. The AI website builder generates a usable starter in minutes, and the all-in-one account management (domain, hosting, professional email) removes vendor complexity for a solo practitioner. The hard stops are familiar to anyone evaluating general-purpose website builders for health practices: GoDaddy does not sign a Business Associate Agreement (BAA) for its website builder or hosting, making it unsuitable for collecting or routing PHI through its forms or web infrastructure. This page covers both sides and compares GoDaddy to Supportsheep for a solo therapist building a marketing site.

## GoDaddy and HIPAA: no BAA for web services

GoDaddy's HIPAA position is clearly documented by multiple compliance authorities: the company does not sign a Business Associate Agreement for its website builder, web hosting, contact forms, analytics, or standard online products. Using GoDaddy's form blocks to collect patient intake information, medication history, or session-related content is not HIPAA-compliant.

The one documented exception is Microsoft 365 email through GoDaddy's reseller program. Certain Business Professional and Premium Security M365 accounts purchased through GoDaddy can be used for HIPAA-compliant email. That is email only -- it does not extend to the website, forms, or hosting layer.

For a supportsheep therapy practice, this means the public marketing site (homepage, bio, specialties, blog, FAQ, contact) is fine on GoDaddy. The contact page should link to your EHR's scheduling or intake portal rather than using a GoDaddy form that could receive PHI.

## GoDaddy's AI website builder: what it actually does for therapists

GoDaddy positions its AI builder as a way to launch a professional site in minutes. You enter your practice type and a short description; the AI generates section layouts, copy, and service descriptions. For a solo therapist:

**What the AI builder does well:**
- Generates a usable first-draft structure (homepage, about, services, contact) from minimal input.
- Suggests copy for typical therapy-practice use cases (individual therapy, couples counseling, specialties).
- Keeps everything on one account -- domain, site, professional email.

**What it does not do:**
- It does not produce HIPAA-aware forms or scheduling.
- It does not generate structured data (LocalBusiness, Person, FAQPage JSON-LD) automatically.
- The resulting site's SEO ceiling is lower than dedicated content platforms for the local search competition therapy practices face.
- The blog is basic -- adequate for one or two posts, not designed for the content velocity that compounds into meaningful local search authority over 12-18 months.

## Where GoDaddy works for a solo therapist

**The domain-and-hosting bundle advantage.** GoDaddy's strongest differentiator for therapists is operational simplicity: if you already registered your practice domain with GoDaddy, building the website there keeps everything in one place. One login, one bill, one support line. For a solo practitioner with no technical support, that simplicity is real value.

**AI-assisted fast launch.** Getting a professional-looking practice website live quickly matters. A therapist opening a new practice or transitioning from an agency to private practice does not want to spend weeks on a website. GoDaddy's AI builder reduces the time-to-live-site to under a day.

**Familiar, accountable infrastructure.** GoDaddy is a large, established company. It has real phone support, an active knowledge base, and a track record. For a practitioner who needs to know someone is there when the site has an issue, that counts.

## Where GoDaddy breaks down for therapists

**No BAA -- and no path to one for web services.** This is the clearest gap. Unlike Wix (which added HIPAA mode in 2026) and Squarespace (which has Acuity Scheduling for HIPAA-aware booking), GoDaddy has no planned or existing path to a BAA for website builder or hosting services. For a therapy practice where any form submission could receive PHI by context, this means the marketing site and the intake/scheduling system must be completely separate by design.

**SEO ceiling matters for therapists.** Local SEO is the primary acquisition channel for most solo therapists in private practice. The search queries that bring new clients ("anxiety therapist [city]," "EMDR therapist [neighborhood]," "couples therapist near me accepting insurance") are local and competitive. GoDaddy's builder handles basic on-page SEO but lacks automated schema (LocalBusiness, Person, FAQPage), which is a meaningful gap when competitors are using platforms that automate these signals. Therapist-specific SEO requires consistent FAQ content, specialty pages per modality, and structured data -- GoDaddy requires manual injection for all of these.

**Template design quality.** GoDaddy's templates are functional but not design-forward. For a therapy practice where trust is the primary conversion driver, design quality matters. The credibility signal of a well-designed site is more important for therapy than for, say, a hardware store. GoDaddy's design ceiling is below Squarespace's and Wix's.

**Limited blog and content platform.** Therapists who invest in educational content -- "what is EMDR therapy," "CBT exercises for anxiety," "how to find a trauma therapist" -- build genuine search authority over time. GoDaddy's blog is a box for posts, not a content-velocity platform. It lacks SEO sidebar audits, internal link suggestions, structured data on FAQ content, and thin-content detection.

## The recommended architecture for a GoDaddy-hosted therapy practice

If you use GoDaddy for the website, the clinical-workflow split is identical to any other general-purpose CMS:

1. **Public marketing site on GoDaddy.** Homepage, bio, specialties (one per focus area), FAQ, blog, and a contact page that links to your EHR intake or scheduling portal. No PHI on this layer.
2. **EHR with client portal for clinical workflow.** SimplePractice, TherapyNotes, TheraNest, or Headway handles intake forms, telehealth, session notes, billing, and secure client messaging. This vendor signs your BAA.
3. **Contact page links to EHR, not a GoDaddy form.** Replace the default GoDaddy contact form with a clear CTA: "Request an appointment through my secure client portal" with a link to your EHR's scheduling page.
4. **Audit tracking pixels.** GoDaddy's analytics and any third-party pixels (Google Analytics, Meta Pixel) must not fire after a clinical form submission. Audit and configure exclusions.

## Supportsheep's position for a solo therapist evaluating GoDaddy

Supportsheep is designed for the "supportsheep professional service business that wants a credible, content-driven marketing site with minimal overhead." For a solo therapist:

- **Free tier with custom domain.** A therapist can launch the marketing site on Supportsheep's free tier with their own domain. GoDaddy's website builder is paid; the domain registration is separate.
- **AI onboarding that generates a full first draft.** Supportsheep's onboarding generates a multi-page first draft (homepage, services, about, FAQ, contact) from a business description, using business context to seed copy and section content. This is comparable to GoDaddy's AI builder but on a content-and-SEO-first architecture.
- **Blog with SEO sidebar, AI drafting, and automated schema.** Supportsheep's blog emits FAQPage JSON-LD on Q&A content, LocalBusiness schema on the practice page, and Article schema on posts -- without a plugin or code injection. A therapist who writes posts about their specialties gets structured data automatically.
- **Privacy-first posture.** For therapists whose clients are privacy-conscious, Supportsheep's privacy-first design signals intentional privacy engineering rather than growth-hack tooling. That signal is credible and consistent with a therapy practice's values.

## Side-by-side: GoDaddy vs Supportsheep for a therapy practice

<table>
<thead>
<tr><th>Feature</th><th>GoDaddy Website Builder</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>AI site generation</td><td>Yes -- AI setup from practice type and description</td><td>Yes -- AI onboarding generates multi-page first draft with business context</td></tr>
<tr><td>Starting price</td><td>Paid plans required; typically $10-$25/mo</td><td>Free tier with custom domain</td></tr>
<tr><td>HIPAA BAA</td><td>No -- not available for website builder or hosting</td><td>Not applicable -- link to SimplePractice, TherapyNotes, or Acuity Premium for PHI</td></tr>
<tr><td>Blog and SEO tooling</td><td>Basic blog; title and meta fields; no automated schema</td><td>Blog with SEO sidebar, AI drafting, LocalBusiness + FAQPage + Article schema by default</td></tr>
<tr><td>Template quality</td><td>Functional; below Squarespace and Wix design floor</td><td>Consistent layouts tuned for content; constrained but not inconsistent</td></tr>
<tr><td>Domain bundling</td><td>Strong -- GoDaddy's core business; domain + hosting + email in one account</td><td>Managed hosting with custom domain; GoDaddy can hold the domain registration</td></tr>
<tr><td>Best fit</td><td>Therapists already using GoDaddy for domain/email who want a quick no-code site on the same account</td><td>solo therapists prioritizing content, local SEO, structured data, and low monthly cost</td></tr>
</tbody>
</table>`;

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
    question: "Is GoDaddy HIPAA compliant for a therapy practice?",
    answer:
      "No. GoDaddy does not sign a Business Associate Agreement for its website builder, web hosting, or contact forms. HIPAA compliance authorities consistently confirm that GoDaddy's web products cannot be used to collect, store, or transmit PHI. The only partial exception is GoDaddy's Microsoft 365 email reseller offering on certain Business Professional and Premium Security plans, which can support HIPAA-compliant email. That is email only -- not websites or forms. A therapy practice using GoDaddy must route all intake, scheduling, and client communication to a dedicated HIPAA-aware EHR (SimplePractice, TherapyNotes, Headway) that signs a BAA.",
  },
  {
    question: "Can I use GoDaddy for a therapy or counseling practice website?",
    answer:
      "Yes, for the public marketing layer. A GoDaddy site is appropriate for the homepage, bio, specialty pages, FAQ, blog, and a contact page that links to your EHR intake portal. It is not appropriate for collecting intake information, session history, symptoms, or any PHI through GoDaddy forms. The contact form on a GoDaddy therapy site should be limited to name and email with a clear disclaimer, with substantive intake routed to your EHR's secure client portal.",
  },
  {
    question: "Should I use GoDaddy or Supportsheep for my therapy practice website?",
    answer:
      "Choose GoDaddy if you already manage your domain, hosting, and email through GoDaddy and want to keep everything on one account for simplicity. Choose Supportsheep if you want a free tier with a custom domain at launch, a blog with an SEO sidebar and AI drafting, LocalBusiness and FAQPage schema automated by default, and a lower monthly cost at the Pro tier ({{supportsheep.pro.yearly}} billed annually). Both platforms require the same HIPAA architecture: marketing site in the CMS, PHI workflow in your EHR.",
  },
  {
    question: "How do therapists find new clients through their website?",
    answer:
      "The primary web-based acquisition channel for solo therapists in private practice is local search: 'anxiety therapist [city],' '[modality] therapist [neighborhood],' 'therapists accepting new patients [city].' Three levers matter most: (1) Google Business Profile -- claim it, fill every field, collect reviews; (2) specialty pages with LocalBusiness and Person schema; (3) educational blog content that answers questions your prospective clients search before reaching out. Supportsheep's blog ships FAQPage and LocalBusiness schema automatically, reducing the per-post setup cost. GoDaddy requires manual schema injection for these signals.",
  },
  {
    question: "What EHR tools work best with a GoDaddy or Supportsheep therapy site?",
    answer:
      "SimplePractice (the most widely used EHR for supportsheep/small-group private practice; handles intake, telehealth, notes, billing, client portal; signs a BAA), TherapyNotes, TheraNest, and Headway. For scheduling only, Acuity Scheduling on the Premium plan is BAA-eligible. The pattern is the same with either CMS: link from the contact page to your EHR's scheduling URL; do not attempt to handle intake through the marketing site.",
  },
  {
    question: "How does GoDaddy's AI website builder compare to Supportsheep for therapists?",
    answer:
      "Both use AI to accelerate the initial site creation from a business description. GoDaddy's AI builder is faster to first draft and keeps domain, hosting, and email on one account. Supportsheep's AI onboarding generates a multi-page first draft on a content-and-SEO-first architecture, with structured data (LocalBusiness, FAQPage, Article) emitted automatically and an SEO sidebar in the blog for ongoing content optimization. GoDaddy's builder is simpler to start; Supportsheep's architecture compounds more effectively into local search authority over 12-18 months of content production.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:godaddy-for-therapists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:godaddy-for-therapists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at GoDaddy's website builder for solo therapists -- covering the HIPAA/BAA position, AI setup strengths, SEO ceiling, and when Supportsheep is the better default for content and local search.",
        ctaText: "Start your therapy practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Therapists",
      },
      title: "GoDaddy for therapists: an honest alternative",
      metaDescription:
        "Is GoDaddy right for a therapy practice website? An honest comparison covering HIPAA BAA posture, AI site generation, SEO limits, and when Supportsheep is the better default.",
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
    `[pilot:godaddy-for-therapists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/godaddy/for/therapists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:godaddy-for-therapists] failed:", err);
    process.exit(1);
  });
