/**
 * Phase 1 pilot: seed `/alternatives/squarespace/for/therapists`.
 *
 * Doc id and `variantKey` are both `squarespace__therapists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-squarespace-therapists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "squarespace__therapists";
const VARIANT_KEY = "squarespace__therapists";

const CONTENT = `## TL;DR

Squarespace is a genuinely polished website builder for a solo or small therapy practice's public marketing presence. The hard limit arrives the moment your site touches protected health information (PHI): Squarespace does not sign a Business Associate Agreement (BAA) for its core platform -- forms, email, analytics, member areas. Plenty of therapy practices run their public site on Squarespace and route anything clinical -- intake forms, scheduling, session notes -- to a separate HIPAA-aware tool. This page walks through that setup honestly, covers where Squarespace falls short for therapists, and explains when Supportsheep is the better default.

## What PHI actually means on a therapy website

A contact form that asks "What brings you in?" collects PHI. A general "Name / email / message" form probably does not -- but if the visitor's reply describes their symptoms or current treatment, the submission is PHI by context, even if you didn't ask for it.

Squarespace's own documentation is explicit: its contact form block, email campaigns, and analytics pipeline cannot be part of a HIPAA-compliant solution. That is not a bug in Squarespace -- it is a deliberate scope decision. The platform is built for marketing, not clinical workflow. A therapy practice can absolutely use Squarespace; it just needs to build a firm boundary between the public marketing site and any clinical-data touchpoint.

## Squarespace's HIPAA posture (what it will and won't sign)

Squarespace does not offer a BAA for the core website platform. This means the following are outside HIPAA compliance on Squarespace without an external workaround:

- **Form blocks.** Do not collect PHI through a Squarespace form block. Replace them with a HIPAA-aware form provider: Hushmail Forms, Jotform HIPAA, IntakeQ, SimplePractice, or your EHR's native intake portal.
- **Email campaigns.** Squarespace's email product is not BAA-eligible. Do not send clinical content through Squarespace Email.
- **Scheduling embeds.** Acuity Scheduling (a separate Squarespace product) can be configured to support a BAA on the Premium plan (~$49/month). The embedded Acuity block on a Squarespace marketing page can point to that BAA-eligible scheduler.
- **Analytics.** Squarespace analytics does not offer a BAA. If your practice uses marketing pixels that fire on a thank-you page after a clinical form submission, those pixels may inadvertently capture PHI. Audit and remove them.

In practice: therapists widely use Squarespace for homepage, bio, specialties, blog, testimonials, and outbound links to HIPAA-aware scheduling. That usage pattern is defensible. A form that routes clinical intake to your EHR (SimplePractice, TherapyNotes, TheraNest) via an iframe or external link is fine. A Squarespace form block that receives "I'm struggling with anxiety and trauma and want to schedule a session" is not.

## Where Squarespace works well for therapists

Be honest about the tool's strengths before pointing at the gaps:

- **Credible-looking sites without a designer.** The template library is strong. A solo therapist can launch a clean, professional-looking site on a weekend -- which beats the alternative of delaying the site indefinitely.
- **Good for "soft" content.** A bio page, a specialties page, a FAQ page, a blog about coping skills or therapeutic modalities -- this is Squarespace's sweet spot. Design is trustworthy, the blog is usable, and the editor is approachable.
- **Mobile-first rendering.** All templates are responsive by default. Mobile-first indexing won't punish a default Squarespace site.
- **Bundles hosting, SSL, and domain in one bill.** A solo practitioner doesn't want to manage servers. Squarespace handles it, which matters for a practice that should be thinking about clients, not infrastructure.
- **Blog for thought leadership.** Content marketing is genuinely effective for therapists -- "how CBT works," "[city] EMDR therapist," "what is attachment theory" rank in local and informational search. Squarespace's built-in blog is enough for a modest content strategy.

## Where Squarespace breaks down for therapists

- **No BAA on core forms.** Detailed above. This is the most consequential limitation and the reason most therapy-focused web designers recommend Squarespace + an external HIPAA-aware intake tool rather than an all-in-one Squarespace site.
- **SEO ceiling is real.** Marketing firms that specialize in therapist SEO consistently note that Squarespace's customization surface is shallow compared to WordPress. You can set titles, meta descriptions, and image alt text -- but granular schema, redirect management, and programmatic local SEO pages are awkward.
- **Limited automation.** Therapy practices benefit from automated appointment reminders, follow-up sequences, and waitlist management. Squarespace has no native equivalent. You add these via Zapier, which adds cost and brittle integrations.
- **Template lock-in.** Picking a new visual direction mid-life means a rebuild, not a switch. Not unique to Squarespace, but a real friction for a practice that wants to evolve its brand.
- **Forms can't carry conditional logic.** A mental-health screening intake often needs branching (if the client answers "yes" to this question, show this follow-up). Squarespace forms are flat. You need an external form tool for anything more complex.

## Supportsheep's position for a solo therapy practice

Supportsheep is designed for the "one-to-three practitioner service business that needs a credible marketing site without becoming a part-time web developer" use case. How that maps to a solo therapist:

- **Free tier with a connected custom domain.** A solo therapist launching a practice can point their domain at Solo before committing to a paid plan. Squarespace requires a paid subscription once the trial ends.
- **Blog with SEO sidebar and AI drafting.** Supportsheep's blog is built around content velocity: title and meta audits, internal link suggestions, FAQPage JSON-LD on pages that have Q&A sections. A therapist who wants to write six posts per year on common concerns their clients have benefits from a content platform, not just a blog box.
- **Structured data by default.** LocalBusiness schema, Article schema on posts, FAQPage schema on FAQ blocks, BreadcrumbList on nested pages -- these ship without a plugin or a custom code block. A solo practice competing in a mid-size city needs every structured-data signal it can get.
- **Honest about PHI boundaries.** Supportsheep does not collect PHI and does not offer a BAA. The correct architecture is identical to Squarespace: public marketing site on Supportsheep, clinical workflow (intake, scheduling, messaging) on a HIPAA-aware platform (SimplePractice, TherapyNotes, Headway, your EHR). This is a feature -- it means the marketing site has a small, predictable attack surface.
- **Privacy-first posture.** For therapists whose clients are privacy-sensitive (which is most of them), a privacy-first platform signals "this is not a growth-hack tool" in a way that some therapy-forward clients notice.

## Side-by-side: Squarespace vs Supportsheep for a therapy practice

<table>
<thead>
<tr><th>Feature</th><th>Squarespace (Basic / Core / Plus)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$16/mo (Basic) -- $39/mo (Plus)</td><td>Free tier with custom domain</td></tr>
<tr><td>HIPAA BAA on core contact forms</td><td>No -- Squarespace documents this explicitly</td><td>Not applicable -- Supportsheep does not handle PHI; use HIPAA-aware intake tools</td></tr>
<tr><td>HIPAA BAA on scheduling</td><td>Yes, via Acuity Scheduling Premium (~$49/mo separate)</td><td>Link to HIPAA-aware scheduler (SimplePractice, Acuity Premium, TherapyNotes)</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; titles, meta, sitemap; shallow customization</td><td>Blog with SEO sidebar, AI drafting, FAQPage + LocalBusiness schema by default</td></tr>
<tr><td>Structured data</td><td>Basic schema; no automated LocalBusiness or FAQPage JSON-LD</td><td>LocalBusiness, Article, FAQPage schema ship without plugins</td></tr>
<tr><td>Best fit</td><td>Design-led solo practices that want visual polish and will wire up an EHR intake stack</td><td>1-3 clinician practices that prioritize content, local SEO, and low overhead</td></tr>
</tbody>
</table>

## The correct architecture for a HIPAA-safe therapy website

Regardless of whether you use Squarespace or Supportsheep, the architecture is the same:

1. **Public marketing site** (Squarespace or Supportsheep): homepage, bio, specialties, blog, FAQ, testimonials, contact page with a link (not a form) to your intake tool.
2. **HIPAA-aware intake tool** (SimplePractice, TherapyNotes, TheraNest, Headway, IntakeQ, Jotform HIPAA): the intake form, session scheduling, secure client messaging, and session notes live here. This vendor signs your BAA.
3. **Scheduling embed or link**: either embed your HIPAA-compliant scheduler via an iframe (provided the embed itself doesn't pass PHI through the parent URL), or link out with clear copy like "Book a free consult →".
4. **Audit your pixels**: if you run Google Analytics or Meta Pixel on your marketing site, make sure those pixels don't fire after a clinical form submission. Configure exclusions at the trigger level.

This setup keeps PHI entirely outside the marketing CMS and concentrates clinical-data responsibility in a purpose-built tool that has already done the HIPAA engineering.

## HIPAA-aware tools that pair well with Squarespace or Supportsheep

- **SimplePractice** -- most popular EHR for solo/small group private-practice therapists; handles scheduling, telehealth, intake, notes, billing, and offers a client portal. Signs a BAA.
- **TherapyNotes** -- popular with larger practices; robust notes and billing; client portal signs a BAA.
- **TheraNest** -- strong for practice management; BAA available.
- **Headway** -- insurance-credentialing + EHR platform aimed at modern private-practice therapists; signs a BAA.
- **IntakeQ / Acuity Scheduling (Premium)** -- HIPAA-aware intake forms and scheduling if you prefer a lighter tool.
- **Hushmail for Healthcare** -- HIPAA-compliant email and forms for smaller practices that don't need a full EHR.

## Five steps for a therapist launching or migrating a website

1. **Pick your EHR first.** The EHR choice determines which intake and scheduling tools you get. Map your website design to the EHR, not the other way around.
2. **Build the public marketing site.** Homepage, about page, specialties, FAQ, blog, a contact page that directs visitors to your EHR intake link. Do not put a form on this page that could collect PHI.
3. **Audit your forms.** Every field that could prompt a PHI response ("What brings you in?", "Current medications?", "Previous therapist?") belongs in the EHR intake flow, not on the marketing site.
4. **Add structured data.** LocalBusiness schema with your practice name, address, phone, and specialty signals trust to search engines and populates the Google Knowledge Panel for local search.
5. **Start a content rhythm.** Four to six blog posts per year on specific concerns (anxiety management for healthcare workers in [city], preparing for EMDR therapy, etc.) compounds over 12-18 months into meaningful local search presence. Supportsheep's SEO sidebar makes this less tedious.`;

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
    question: "Is Squarespace HIPAA compliant for a therapy practice?",
    answer:
      "Not for its core platform. Squarespace does not sign a Business Associate Agreement (BAA) for its contact form blocks, email campaigns, analytics, or member areas. A therapy practice can use Squarespace for its public marketing site, but must route any contact form that could collect PHI to a HIPAA-aware tool (SimplePractice portal, IntakeQ, Jotform HIPAA, or Hushmail) rather than a native Squarespace form. Acuity Scheduling (a separate Squarespace product) can be configured to support a BAA on the Premium plan.",
  },
  {
    question: "What booking tools are HIPAA compliant for therapists?",
    answer:
      "Widely used options that sign BAAs include SimplePractice (full EHR with scheduling and client portal), TherapyNotes, TheraNest, Headway, IntakeQ, and Acuity Scheduling on the Premium plan. The correct pattern is to keep the public marketing site on Squarespace or Supportsheep and link out to one of these tools for anything that touches PHI -- do not attempt to make a Squarespace or Supportsheep contact form the intake channel.",
  },
  {
    question: "Should I use Squarespace or Supportsheep for my therapy practice website?",
    answer:
      "Choose Squarespace if visual polish and template choice are the deciding factors and you are comfortable maintaining a separate HIPAA-aware intake and scheduling stack. Choose Supportsheep if you want a free tier with a connected custom domain, a blog with an SEO sidebar and AI drafting, built-in LocalBusiness and FAQPage structured data, and a platform that leans into content velocity for local SEO. Both tools have the same HIPAA boundary -- neither handles PHI natively -- so the choice comes down to design priority vs. content-and-SEO priority.",
  },
  {
    question: "Can a Squarespace contact form collect mental health intake data?",
    answer:
      "No. Squarespace's own help documentation states that its contact form blocks cannot be part of a HIPAA-compliant solution. Do not collect mental health history, diagnoses, medication lists, symptom descriptions, or other PHI through a Squarespace form. Use your EHR's client portal or a HIPAA-certified form provider (IntakeQ, Jotform HIPAA, Hushmail Forms, FormDr) and link to it from your Squarespace site.",
  },
  {
    question: "What SEO strategies work for private practice therapists?",
    answer:
      "Local SEO is the highest-leverage channel for most solo practices. Key tactics: claim and optimize your Google Business Profile; add LocalBusiness and Person schema to your site; write specialty-and-city-specific content (e.g., 'EMDR therapist for first responders in [city]'); build FAQ pages around common client questions that match informational queries. Supportsheep's blog ships with FAQPage JSON-LD on pages with Q&A content, which can help FAQ answers appear in rich results. Squarespace requires you to add schema manually via a code block or a third-party SEO tool.",
  },
  {
    question: "What does a therapy practice website need to include?",
    answer:
      "Homepage with clear specialty and location, a detailed about/bio page, a specialties or services page (one page per focus area improves topical authority for local search), a FAQ page addressing common client concerns, a contact page that links to your HIPAA-aware scheduling tool (not a native form collecting PHI), and optionally a blog for content marketing. Avoid collecting clinical information through the CMS; that belongs in the EHR workflow.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:squarespace-for-therapists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:squarespace-for-therapists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at using Squarespace for a solo or small therapy practice -- including the HIPAA/BAA boundaries and where Supportsheep is the better default for content and local SEO.",
        ctaText: "Start your therapy practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Therapists",
      },
      title: "Squarespace for therapists: an honest alternative",
      metaDescription:
        "Is Squarespace right for a therapy practice? An honest comparison covering HIPAA/BAA limits, intake form risks, SEO ceiling, and when Supportsheep is the better default.",
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
    `[pilot:squarespace-for-therapists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/squarespace/for/therapists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:squarespace-for-therapists] failed:", err);
    process.exit(1);
  });
