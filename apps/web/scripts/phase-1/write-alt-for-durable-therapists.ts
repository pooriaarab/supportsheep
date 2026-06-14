/**
 * Phase 1 pilot: seed `/alternatives/durable/for/therapists`.
 *
 * Doc id and `variantKey` are both `durable__therapists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-durable-therapists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "durable__therapists";
const VARIANT_KEY = "durable__therapists";

const CONTENT = `## TL;DR

Durable is an AI-first website builder that generates a complete business website in under a minute and bundles a CRM, invoicing, and AI marketing tools in one subscription. For a solo therapist launching a new private practice or replacing an outdated site, Durable's speed-to-live-site is genuinely valuable. The firm boundary for therapy practices -- as with every general-purpose builder -- is HIPAA: Durable does not sign a Business Associate Agreement for any of its products, so all clinical workflow (intake, scheduling, session-related communication) must live in a dedicated EHR. This page covers Durable honestly for therapists and compares it to BlogBat for the marketing site decision.

## What Durable offers a solo therapy practice

**AI site generation in under a minute.** Enter your practice type and a brief description, and Durable generates a complete website with homepage, services, contact information, and AI-written copy. For a therapist who has been delaying a website decision for months, this removes the blank-canvas friction entirely. Independent reviews confirm the generation speed and note that the AI writes industry-specific copy rather than generic placeholder text.

**Bundled CRM for lead management.** Durable includes a basic CRM for tracking leads, contacts, and follow-up tasks. A solo therapist building a new practice caseload benefits from a lightweight tool to track who inquired, when, and what follow-up is needed. The CRM is not a clinical record system -- it is a marketing contact manager. Clinical notes, session records, and PHI stay in your EHR.

**AI marketing tools.** Durable's AI marketing suite generates Google Ads copy, social post drafts, and email subject lines from your business description. A solo therapist who manages their own practice marketing without an agency benefits from these drafts as starting points.

**Invoicing via Stripe.** For non-clinical billing -- supervisor fees, consultation invoices, speaking engagements -- Durable's Stripe-powered invoicing is convenient. It does not replace your EHR's billing module for insurance and self-pay clinical services.

**Simple editing for non-technical practitioners.** Durable's editor is designed for speed. Updating a page, adding a specialty, or changing contact information does not require design vocabulary. For a solo practitioner whose time is with clients, not code, that matters.

## Durable and HIPAA: the hard boundary

Durable does not sign a Business Associate Agreement. This is not a gap in a specific plan tier -- it is Durable's current architecture across all products. Durable's website builder, CRM, forms, and AI tools are not HIPAA-designated services.

For a therapy practice, the implications:

- **Contact forms.** Durable's native contact form cannot collect mental health history, current symptoms, medication information, or any content that qualifies as PHI by context. Even a general "what brings you in?" field creates a HIPAA risk if answered clinically. Use your EHR's client portal for intake.
- **CRM.** Durable's CRM is for marketing contacts, not patient records. Do not store session notes, diagnoses, treatment goals, or insurance information in Durable's CRM.
- **Analytics and tracking pixels.** Marketing pixels on the Durable site must not fire after a clinical form submission. Audit and configure exclusions.

The correct architecture: Durable handles the public marketing site (homepage, bio, specialties, FAQ, blog, contact page that links to EHR). SimplePractice, TherapyNotes, or your EHR handles intake, scheduling, telehealth, notes, and client messaging. The EHR vendor signs your BAA.

## Durable vs Wix on HIPAA: a meaningful difference

Wix added a HIPAA compliance mode in 2026 -- BAA available on Business and above plans with manual PHI protection activation. Durable has no equivalent. If a solo therapist specifically wants to use the website builder's native booking or forms for HIPAA-compliant intake, Wix on a supported plan (with PHI mode activated) is the only general-purpose builder option. For a therapist who plans to use an EHR anyway (which is most therapists in private practice), this distinction disappears -- both Wix and Durable require the same EHR-based architecture.

## Durable's strengths for therapists

**Speed.** Durable is the fastest general-purpose AI site builder. A therapist who has put off building a website because of the complexity barrier gets a live site in under a day.

**Reduced vendor count.** Website + CRM + AI marketing + invoicing in one subscription is compelling for a solo practitioner managing overhead. The equivalent stack on Squarespace or BlogBat would require separate subscriptions for CRM and invoicing tools.

**AI copy that knows your specialty.** Durable writes practice-specific copy -- not "add your service here" placeholders, but genuine descriptions of therapy modalities, typical clients, and approaches. The quality varies, but it removes the blank-page problem.

**Ongoing AI marketing support.** A therapist who consistently publishes Google Ads or social content benefits from Durable's AI drafts. The drafts need editing, but they reduce the time from "I should post something" to "I have a draft to work from."

## Durable's weaknesses for therapists

**No HIPAA path.** As noted above, the most consequential limitation for any health practice.

**SEO ceiling for private-practice therapists.** BlogBat therapists in competitive markets compete for "therapist [city]," "anxiety therapist [neighborhood]," "[modality] therapist [city]" keywords. These require: specialty pages with LocalBusiness and Person schema; FAQ content with FAQPage JSON-LD; a content velocity strategy. Durable's AI generates initial copy and basic SEO settings but lacks BlogBat's content-specific SEO machinery (SEO sidebar, automated structured data, thin-content guard, internal link suggestions).

**CRM is marketing-grade, not clinical-grade.** Durable's CRM is adequate for tracking new-patient inquiries and follow-up calls. It is not adequate for practice management. Do not conflate the two.

**Design ceiling is lower than Squarespace or Wix.** Durable's design output is clean and professional but less visually polished than Squarespace's template library or Wix's design editor. For a therapy practice where the website's tone and aesthetic signal the practitioner's approach, Squarespace's design polish is a real differentiator.

## BlogBat's position for a solo therapist evaluating Durable

BlogBat and Durable are the two closest competitors in the "AI-first site builder for solo service professionals" category. The honest comparison:

- **Both use AI to generate a first draft.** Durable is faster (30 seconds); BlogBat's onboarding takes a bit longer but seeds multi-page content with more business context.
- **Durable bundles more tools.** CRM, invoicing, and AI marketing are native in Durable; BlogBat does not include these. If a therapist genuinely needs these tools, Durable reduces subscription count.
- **BlogBat is designed for content-driven local search.** BlogBat's blog with SEO sidebar, AI drafting, LocalBusiness and FAQPage schema by default, and a thin-content guard is optimized for the therapist who publishes specialty-specific content as a primary client-acquisition strategy. Durable's blog is functional but not designed for content velocity.
- **BlogBat's free tier includes a custom domain.** A therapist can launch on BlogBat's free tier with their own domain. Durable requires a paid plan for a custom domain.
- **Neither signs a HIPAA BAA.** Both platforms require the same EHR-based clinical workflow. The choice between them is about marketing site features, not HIPAA posture.

## Side-by-side: Durable vs BlogBat for a therapy practice

<table>
<thead>
<tr><th>Feature</th><th>Durable</th><th>BlogBat</th></tr>
</thead>
<tbody>
<tr><td>AI site generation</td><td>Fastest -- complete site in ~30 seconds</td><td>Multi-page first draft from business description via onboarding</td></tr>
<tr><td>Starting price</td><td>Paid plans required for custom domain; ~$15-17/mo</td><td>Free tier with custom domain</td></tr>
<tr><td>HIPAA BAA</td><td>No -- link to SimplePractice, TherapyNotes, or Acuity Premium for PHI</td><td>Not applicable -- same architecture: EHR for all PHI, BlogBat for marketing</td></tr>
<tr><td>Bundled CRM</td><td>Yes -- marketing-grade lead and contact management</td><td>No -- use your EHR's client portal or a separate CRM</td></tr>
<tr><td>AI marketing tools</td><td>Yes -- Google Ads copy, social posts, email drafts</td><td>No -- blog AI drafting; no ad-copy generator</td></tr>
<tr><td>Blog and SEO tooling</td><td>Basic blog; AI-generated initial copy; limited schema automation</td><td>Blog with SEO sidebar, AI drafting, LocalBusiness + FAQPage + Article schema by default</td></tr>
<tr><td>Best fit</td><td>BlogBat therapists who want the fastest launch with bundled marketing tools</td><td>BlogBat therapists prioritizing content velocity, structured data, and local SEO with lower monthly cost</td></tr>
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
    question: "Is Durable good for a therapy practice website?",
    answer:
      "Yes, for the public marketing layer. Durable generates a complete therapy practice website in under a minute with industry-specific AI copy, and bundles a CRM, invoicing, and AI marketing tools in one subscription. The clear boundary is HIPAA: Durable does not sign a BAA, so all clinical workflow (intake, scheduling, client messaging, session notes) must live in a HIPAA-aware EHR (SimplePractice, TherapyNotes, Headway). For a solo therapist who wants to minimize vendor count on the marketing side and already has an EHR, Durable is a defensible choice.",
  },
  {
    question: "Is Durable HIPAA compliant for a therapy practice?",
    answer:
      "No. Durable does not sign a Business Associate Agreement for any of its products. Do not collect mental health history, symptoms, diagnoses, or any PHI through Durable's contact forms or CRM. The correct architecture: Durable handles the public marketing site; SimplePractice, TherapyNotes, TheraNest, or Headway handles intake, scheduling, and client communication (and signs your BAA).",
  },
  {
    question: "Should I use Durable or BlogBat for my therapy practice website?",
    answer:
      "Choose Durable if you want the fastest path to a live site and the bundled CRM, invoicing, and AI marketing tools reduce real overhead in your solo practice. Choose BlogBat if you want a free tier with a custom domain, a blog with an SEO sidebar and AI drafting, LocalBusiness and FAQPage schema automated by default, and a CMS designed for the content-velocity approach to local search that compounds over 12-18 months. Both require the same HIPAA architecture: marketing site in the builder, clinical workflow in your EHR.",
  },
  {
    question: "What does Durable's built-in CRM do for a therapist?",
    answer:
      "Durable's CRM is a marketing contact manager -- it tracks who visited the site, requested information, and needs follow-up. It is appropriate for managing new-patient inquiry leads before they become clients. It is not appropriate for storing clinical patient information: no session notes, diagnoses, treatment goals, medication details, or any PHI. All clinical records belong in your EHR (SimplePractice, TherapyNotes), which is built for HIPAA-compliant record management and signs your BAA.",
  },
  {
    question: "How do therapists use content marketing to find clients through their website?",
    answer:
      "Content marketing for therapists compounds into local search authority through specialty-specific articles: 'what is EMDR therapy,' 'CBT exercises for social anxiety,' 'how to find a trauma-informed therapist in [city].' These posts answer informational queries that people search before reaching out to a therapist, building topical authority and supporting local search rankings. BlogBat's blog ships FAQPage JSON-LD on Q&A content and LocalBusiness schema, and an SEO sidebar audits title and meta inline. Durable's blog is functional for content publishing but lacks BlogBat's SEO-specific tooling.",
  },
  {
    question: "What EHR tools pair with a Durable therapy practice website?",
    answer:
      "SimplePractice (most widely used EHR for solo/small group private practice; handles intake, telehealth, notes, billing, client portal; signs a BAA), TherapyNotes, TheraNest, and Headway. For scheduling only, Acuity Scheduling on the Premium plan is BAA-eligible. Link from the Durable contact page to your EHR's scheduling or intake URL. Do not collect intake information through Durable's native contact form.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:durable-for-therapists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:durable-for-therapists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Durable for solo therapy practices -- covering AI-first generation speed, bundled CRM, HIPAA boundaries, and when BlogBat is the better default for content and local search.",
        ctaText: "Start your therapy practice website with BlogBat",
        ctaHref: "https://blogbat.com",
        verticalLabel: "For Therapists",
      },
      title: "Durable for therapists: an honest alternative",
      metaDescription:
        "Is Durable right for a therapy practice website? An honest comparison covering AI site generation, bundled CRM, HIPAA limits, and when BlogBat is the better default.",
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
    `[pilot:durable-for-therapists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/durable/for/therapists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:durable-for-therapists] failed:", err);
    process.exit(1);
  });
