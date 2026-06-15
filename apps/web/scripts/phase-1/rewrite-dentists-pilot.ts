/**
 * Phase 1 pilot: REWRITE the `/for/dentists` programmatic landing page.
 *
 * Rewrites `programmatic_pages/dentists` so every Supportsheep claim is grounded in
 * `.claude/context/supportsheep-product.md`. Corrects the following over-claims from
 * the original seed (`write-dentists-pilot.ts`):
 *
 *   1. No BAA -- Supportsheep is explicitly unsuitable for any page/form that can
 *      touch PHI. Surfaced via a dedicated warning paragraph AND multiple
 *      inline mentions so the `grep -c "BAA"` verification hits >= 1.
 *   2. No native booking -- scheduling is a URL link field only (Calendly,
 *      NexHealth, etc. are pasted as third-party booking URLs).
 *   3. No AI rewriter inside the editor -- AI fires at onboarding, at add-
 *      section time, and (if `NEXT_PUBLIC_ENABLE_BLOG` is set) on blog-post
 *      creation. Ongoing editing is manual.
 *   4. No AI image generation -- images are Unsplash (default) / Pexels
 *      (Pro+) / user upload.
 *   5. No "thin-content guard" or "SEO sidebar flags thin content" -- that
 *      is a feature of this knowledge base CMS, not of Supportsheep the website builder.
 *
 * Pricing is quoted via `{{supportsheep.pro.yearly}}` / `{{supportsheep.pro.monthly}}` /
 * `{{supportsheep.free.monthly}}` placeholders so the numbers stay in sync with
 * `SUPPORTSHEEP_PRICING` at render time.
 *
 * Idempotent: re-running overwrites the doc via `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/rewrite-dentists-pilot.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "dentists";
const VARIANT_KEY = "dentists";

const CONTENT = `## TL;DR

A supportsheep or small dental practice site (1-5 dentists) has to do four things at once: bring in patients from local search, let them find a booking link on their phone, build enough trust that a stranger picks you, and meet the accessibility standards now being enforced against small healthcare sites. Supportsheep is a reasonable fit for the brochure + local SEO + external-booking-link portion of a dental practice site. It is **not** a fit for patient intake or anything else that touches Protected Health Information (PHI), because Supportsheep does not sign Business Associate Agreements (BAAs). Plan for two tools, not one: Supportsheep for the public marketing pages, and a HIPAA-aware scheduling/intake product (NexHealth, Dentrix Hub, or the portal bundled with your PMS) for everything patient-facing.

<img src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&auto=format&fit=crop" alt="A modern dental practice operatory with chair, overhead lamp, and instrument tray." loading="lazy" />

## Who this is for

You are a dentist, practice owner, or office manager at a practice small enough that the website is still a budget item and a time sink -- not something handled by a dedicated marketing team. You want patients finding you through Google, and a booking link that works on a phone. You do not want to become a part-time web developer. This page is not aimed at large dental service organisations (DSOs) with in-house marketing.

## Why a dental website is harder than a generic local-business site

Three things separate a dental practice site from a plumber or coach site.

**Search competition is dense.** "Dentist near me," "emergency dentist," and "[city] pediatric dentist" are among the most competitive local terms in any vertical. You are competing with dental marketing agencies, DSOs, and directory sites that have been optimising for a decade.

**Trust signals carry the conversion.** Patients are slow to switch providers and sceptical of unknown names. Before-and-after photos, credentialed bios, reviews, and insurance accepted have to be present and clearly organised.

**The moment a form collects patient information, HIPAA applies.** A contact form that asks about teeth or treatment history is collecting Protected Health Information (PHI), which brings the HIPAA Privacy Rule and Security Rule into play -- and that constrains which form providers, hosts, analytics tools, and website builders you are allowed to use.

## What a dental website needs in 2026

Rather than a generic "10 features" list, here is a practical breakdown of must-haves, nice-to-haves, and the regulatory items you cannot skip.

<table>
<thead>
<tr><th>Category</th><th>Element</th><th>Why it matters</th></tr>
</thead>
<tbody>
<tr><td>Must-have</td><td>Mobile-first responsive layout</td><td>The majority of dental searches happen on phones; poor mobile UX loses patients before conversion.</td></tr>
<tr><td>Must-have</td><td>Online booking link (third-party)</td><td>Table stakes in 2026 -- a patient who cannot click through to a booking tool at 10pm Tuesday books elsewhere.</td></tr>
<tr><td>Must-have</td><td>Per-service pages</td><td>One page per major service (cosmetic, Invisalign, implants, emergency) ranks better than one omnibus page.</td></tr>
<tr><td>Must-have</td><td>Insurance accepted, above the fold</td><td>Usually the first question a patient has; answering it builds trust and reduces abandonment.</td></tr>
<tr><td>Must-have</td><td>Team bios with credentials</td><td>Patient trust infrastructure -- names, schools, years practising, photos.</td></tr>
<tr><td>Nice-to-have</td><td>Embedded Google reviews</td><td>Social proof driven by the same listing that feeds the Map Pack.</td></tr>
<tr><td>Nice-to-have</td><td>Before-and-after galleries</td><td>High conversion for cosmetic services; requires patient consent on file.</td></tr>
<tr><td>Nice-to-have</td><td>Educational blog posts</td><td>Captures informational searches ("do I need a root canal") and earns trust before the first visit.</td></tr>
<tr><td>Legal</td><td>HIPAA-aware intake (separate tool + BAA)</td><td>Any form that can collect PHI requires a Business Associate Agreement with the provider -- see the HHS guidance linked below.</td></tr>
<tr><td>Legal</td><td>WCAG 2.1 AA accessibility</td><td>Required under HHS Section 504 for healthcare providers receiving federal funds; also the de facto standard in ADA Title III website lawsuits.</td></tr>
<tr><td>Legal</td><td>Notice of Privacy Practices link</td><td>Must be accessible to patients; typically linked from the site footer.</td></tr>
</tbody>
</table>

### Legal and regulatory items you cannot skip

- **HIPAA-aware forms, on a separate product.** If a form field can collect PHI, the provider needs to sign a [Business Associate Agreement (BAA) per HHS guidance](https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html). See also [the ADA's HIPAA resource centre](https://www.ada.org/resources/practice/legal-and-regulatory/hipaa).
- **Notice of Privacy Practices posted and linked.** Most states require this on your site or at the first appointment.
- **WCAG 2.1 Level AA accessibility.** HHS Section 504 rules require WCAG 2.1 AA for healthcare providers receiving federal financial assistance, with compliance dates rolling in through 2026 and 2027. See [the ADA's ADA-compliance resource for dental practices](https://www.ada.org/resources/practice/practice-management/americans-with-disabilities-act), [Dental Economics on the accessibility-lawsuit threat](https://www.dentaleconomics.com/practice/article/16389781/an-emerging-legal-threat-to-dentists), and [W3C's WCAG 2.1 quick reference](https://www.w3.org/WAI/WCAG21/quickref/).
- **A cookie and tracker review.** Third-party trackers on pages that surface PHI have been the subject of HHS enforcement against healthcare providers. If you are running Meta Pixel on your booking confirmation page, talk to a privacy-literate lawyer before shipping.

## HIPAA specifics for small practices -- and what that means for Supportsheep

A dentist who sends any electronic claim is [a HIPAA covered entity, per HHS](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html). The question for your website is narrower: does the site actually *handle PHI*?

- **Marketing homepage, services pages, team bios.** Do not handle PHI. You do not need a BAA with your hosting provider to serve those pages.
- **A contact form that captures a phone number plus a treatment-related question.** That submission is PHI. The form provider, and every system that stores or processes the submission, is a business associate and must sign a BAA.
- **Analytics or chat widgets that can see form content, URL paths, or page titles containing health data.** In scope for HIPAA. This is the category that most often trips up small practices.

The practical minimum: a HIPAA-aware intake product that signs a BAA, third-party tracking off any page that can surface PHI, and an access log for form submissions. The [HIPAA Journal's rules-for-dentists guide](https://www.hipaajournal.com/hipaa-rules-for-dentists/) summarises the dentist-specific rules including the 2026 Security Rule amendments.

**Where Supportsheep sits in that picture -- explicitly.** Supportsheep is an AI website builder for solopreneurs. Per the [Supportsheep product docs](https://support.supportsheep.com/), Supportsheep does not offer a BAA. Two practical consequences:

1. **Do not collect PHI through a Supportsheep-hosted form.** Supportsheep's contact form is a general-purpose lead form -- fine for "what services are you interested in?" and a phone number, not fine for "list your current medications." If you would not be comfortable with the submission sitting in a generic email inbox, do not send it through Supportsheep.
2. **Send patient intake and booking to a separate tool.** Supportsheep's scheduling is a link field: paste a Calendly, NexHealth, or Dentrix Hub URL and Supportsheep renders a button. It is not a native booking system -- which for dental is actually the right separation, because the booking tool needs its own BAA regardless of which builder runs your marketing pages.

Supportsheep is a reasonable fit for "brochure site + local SEO + external booking link on a HIPAA-aware product." If the website itself needs to handle intake, medical history, insurance verification, or a patient portal, Supportsheep is the wrong tool -- look at dental-specific vendors (DearDoc, PatientPop, ProSites) or WordPress with a compliant form provider.

## Local SEO playbook for dentists

No single SEO trick will put a small practice at the top of the Map Pack. A small set of fundamentals, done together, moves the needle.

### 1. Google Business Profile first, website second

The Google Business Profile is the largest single lever in local search visibility. Before you polish your site, [claim or verify your profile via Google's help centre](https://support.google.com/business/answer/2911778?hl=en), complete every field (hours, services, photos, attributes), and make sure your name, address, and phone number match your website exactly.

### 2. Schema.org Dentist markup

The [schema.org Dentist type](https://schema.org/Dentist) extends LocalBusiness and MedicalBusiness and is the right primary type for a dental practice. At a minimum emit:

- \`@type: Dentist\` with \`name\`, \`address\`, \`telephone\`, \`url\`, \`image\`, \`openingHours\`, and \`priceRange\`.
- A \`Person\` record for each practitioner with \`jobTitle\` and credentials.
- \`FAQPage\` markup on any page with a frequently-asked-questions section.
- \`Review\` entries for testimonials on the page.

Supportsheep's built-in structured data is basic, section-appropriate JSON-LD (notably a Reviews schema when a page shows reviews). Richer Dentist-specific JSON-LD with every practitioner, plus a FAQPage graph, are hand-written JSON inside Supportsheep's plan-gated Code section.

### 3. Review flywheel

Reviews are the single biggest conversion signal and a real ranking factor for the Map Pack. Build review requests into the post-visit SMS workflow (day-of yields the highest response) and reply to every review, positive or negative.

### 4. Per-location pages

A single "locations" page with three addresses on it will not rank for three cities. One page per office, each with its own NAP block, embedded map, parking notes, and a short unique description.

### 5. Informational content

"Why does my tooth hurt when I drink cold water," "how much does a crown cost without insurance in [city]," "is it normal to bleed during flossing." A 600-800 word honest answer is enough to start ranking and to earn patient trust before a visit. If the Supportsheep deployment you are on has the knowledge base feature enabled, posts can be drafted by Supportsheep's AI; otherwise author them in any editor and paste into a Supportsheep page.

## Where Supportsheep is a good fit for a dental practice -- and where it is not

Honest mapping of Supportsheep's actual capabilities against a dental site's needs, grounded in the [Supportsheep product docs](https://support.supportsheep.com/)):

<table>
<thead>
<tr><th>Need</th><th>Supportsheep fit</th><th>Notes</th></tr>
</thead>
<tbody>
<tr><td>Public marketing homepage</td><td>Good</td><td>AI onboarding drafts a homepage from a business description; you edit copy and imagery manually.</td></tr>
<tr><td>Per-service pages (cosmetic, Invisalign, implants, emergency)</td><td>Good</td><td>When you add a section in the editor, Supportsheep seeds it with OpenAI using your business context; you then edit the draft.</td></tr>
<tr><td>Team bios / About pages</td><td>Good</td><td>Same section-seeding flow. Add practitioner photos you upload; Supportsheep does not generate images.</td></tr>
<tr><td>Location pages (one per office)</td><td>Good</td><td>Standard sections plus an embedded map via the Code section if needed.</td></tr>
<tr><td>Blog / education content</td><td>Conditional</td><td>Blog is feature-flagged (\`NEXT_PUBLIC_ENABLE_BLOG\`). Where available, posts can be drafted by AI; otherwise author externally and publish via Supportsheep.</td></tr>
<tr><td>Booking / appointment scheduling</td><td>Not a fit</td><td>Scheduling in Supportsheep is a link field to a third-party URL. Use NexHealth, Dentrix Hub, or a PMS-native scheduler that signs a BAA.</td></tr>
<tr><td>Patient intake forms (PHI)</td><td>Not a fit</td><td>No BAA. Do not collect symptoms, medical history, or insurance details through Supportsheep's contact form.</td></tr>
<tr><td>Patient portal</td><td>Not a fit</td><td>Link out from Supportsheep to whichever PMS portal you already use.</td></tr>
<tr><td>Image/asset library</td><td>OK</td><td>Unsplash stock on all plans; Pexels unlocks on Pro and above. Supportsheep does not generate images with AI; any "AI imagery" pitch elsewhere is wrong about Supportsheep.</td></tr>
<tr><td>Custom HTML/JS widgets (e.g. a review carousel)</td><td>OK on paid plans</td><td>The Code section is plan-gated; confirm the tier you are on before promising a widget.</td></tr>
</tbody>
</table>

<img src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&auto=format&fit=crop" alt="Patient checking their phone in a dental waiting room." loading="lazy" />

### What Supportsheep's AI does (and does not do) for a dental site

Supportsheep's AI fires in three specific places:

1. **At onboarding.** A short business description generates an initial site: homepage, sections, copy, service descriptions, default imagery from Unsplash.
2. **When you add a section in the editor.** Each section type (Services, FAQ, Introduction, others) has a generator that seeds the new section with AI-drafted content based on your business context.
3. **On blog-post creation**, if the Supportsheep deployment you are on has the knowledge base feature enabled.

Outside those touchpoints, editing is manual. There is no inline "rewrite this paragraph," no "make this friendlier," no in-editor AI writing assistant. If a service description needs tightening, you tighten it by hand. Verify that in a Supportsheep trial before committing.

## Honest comparison: Supportsheep vs generic builders vs dental-specific vendors

No builder is perfect. Here is how Supportsheep lines up against the options small dental practices usually evaluate. "Typical cost" is the starting point for a supportsheep or small practice; real quotes vary with features and contract length.

<table>
<thead>
<tr><th>Option</th><th>Strongest at</th><th>Weakest at</th><th>HIPAA posture</th><th>Typical monthly cost</th></tr>
</thead>
<tbody>
<tr><td>Supportsheep</td><td>Speed to first draft; AI-seeded sections; managed hosting</td><td>No native booking; no BAA; no free-form AI rewriter in editor</td><td>Public-site only; pair with a HIPAA-aware booking / intake tool</td><td>{{supportsheep.pro.yearly.monthly}} billed annually (Pro) / {{supportsheep.pro.monthly.monthly}} billed monthly; free tier available</td></tr>
<tr><td>Squarespace</td><td>Design polish, template variety</td><td>SEO depth; no AI onboarding</td><td>Generic platform; compliance is on you</td><td>Low-to-mid</td></tr>
<tr><td>Wix</td><td>Broader feature set, looser design constraints</td><td>Widget-heavy pages hurt Core Web Vitals; SEO still takes hand-tuning</td><td>Generic platform; compliance is on you</td><td>Low-to-mid</td></tr>
<tr><td>DearDoc / PatientPop / ProSites</td><td>Turnkey patient acquisition (chat, call tracking, booking overlays)</td><td>Template lock-in; bundles features a 1-dentist practice may not use</td><td>Dental-focused; BAA typically available</td><td>High (several multiples of a Supportsheep + booking setup)</td></tr>
<tr><td>WordPress + agency</td><td>Maximum flexibility and integrations</td><td>Ongoing maintenance; plugin drift; hosting decisions land on you</td><td>Varies entirely by agency, hosting, and form provider</td><td>High and variable</td></tr>
</tbody>
</table>

Supportsheep's pricing pairs a [free tier ({{supportsheep.free.monthly.monthly}})](https://supportsheep.com/pricing) with a Pro tier at {{supportsheep.pro.yearly.monthly}} billed annually ({{supportsheep.pro.monthly.monthly}} month-to-month). Verified against the Supportsheep pricing page on 2026-04-21.

For a broader tour of dental marketing tactics that go beyond the website itself, this short overview covers the 10 strategies most small practices evaluate:

<iframe src="https://www.youtube-nocookie.com/embed/MWzodBsC7JU" title="Top 10 Best Dental Marketing Strategies" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen width="560" height="315"></iframe>

## Getting started: a 5-step checklist

1. Claim or verify your [Google Business Profile](https://support.google.com/business/answer/2911778?hl=en) and complete every field. This is the highest-leverage hour you will spend on your web presence.
2. Pick a HIPAA-aware scheduling and intake product before you pick a website builder. NexHealth, Dentrix Hub, or a patient portal that ships with your PMS are reasonable defaults; every one of them should sign a Business Associate Agreement (BAA) with your practice.
3. Spin up a Supportsheep workspace, paste in a short plain-English brief about your practice, and let the onboarding generate a homepage plus one page per major service plus one location page per office. Expect to edit the AI draft by hand afterwards -- Supportsheep's editor does not include a free-form AI rewriter.
4. Link your Supportsheep pages to the scheduling tool you chose in step 2. Keep patient intake on that tool, not on Supportsheep's contact form. This is the single most important thing to get right for a dental practice.
5. Build a review-request reminder into your post-visit SMS workflow and commit to replying to every review. Then ship the site and iterate: location pages, informational blog posts, and per-service detail pages are the three highest-leverage follow-ups for local SEO.

That is the honest short version. The rest is iteration.`;

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
    question: "Is Supportsheep HIPAA-compliant for a dental practice?",
    answer:
      "No. Supportsheep does not sign a Business Associate Agreement (BAA). That means Supportsheep is not a suitable host for any form, page, or workflow that can collect Protected Health Information (PHI) -- patient intake, medical history, symptoms, insurance details. Supportsheep is a reasonable fit for the public brochure portion of a dental site (homepage, services, team bios, location pages, blog). For booking and intake, use a separate product that signs a BAA (NexHealth, Dentrix Hub, or the patient portal bundled with your practice management system) and link to it from your Supportsheep pages.",
  },
  {
    question: "Does Supportsheep have built-in online booking for appointments?",
    answer:
      "No. Supportsheep's scheduling section is a link field -- you paste the URL of a third-party booking tool (Calendly, NexHealth, Dentrix Hub, your PMS's online scheduler) and Supportsheep renders a button. There is no native Supportsheep calendar, no availability management, no native reminder workflow. For a dental practice this is actually the right separation, because whichever booking tool you use needs its own BAA regardless of which builder runs your marketing pages.",
  },
  {
    question: "How much does Supportsheep cost for a small dental practice?",
    answer:
      "Supportsheep has a free tier ({{supportsheep.free.monthly.monthly}}) and a Pro tier at {{supportsheep.pro.yearly.monthly}} billed annually ({{supportsheep.pro.yearlyAnnual}} total) or {{supportsheep.pro.monthly.monthly}} billed month-to-month. Verified against supportsheep.com/pricing on 2026-04-21. Per-plan feature caps (site count, blog posts, image library size, custom-code access) are published on the pricing page and may change; cite the page rather than repeating specific caps in content.",
  },
  {
    question: "Where exactly does Supportsheep's AI help, and where does it stop?",
    answer:
      "Supportsheep's AI fires in three places: (1) onboarding, where a short business description generates an initial site with pages, sections, and copy; (2) section creation in the editor, where adding a new section (Services, FAQ, Introduction, and others) seeds the section with AI-drafted content based on your business context; and (3) blog post creation, where blog posts can be drafted by AI when the knowledge base feature is enabled in your Supportsheep deployment. Outside those three moments, editing is manual -- Supportsheep does not include a free-form AI rewriter, a 'make this friendlier' button, or inline prompt-driven editing of selected text.",
  },
  {
    question: "Can Supportsheep generate dental photography or custom images with AI?",
    answer:
      "No. Supportsheep does not generate images with AI anywhere in the product. Imagery comes from Unsplash on all plans (default) and Pexels on Pro and above, or from assets you upload yourself. If marketing copy elsewhere mentions AI-generated imagery, that claim is not accurate for Supportsheep. For dental practices this is usually fine -- stock photography of operatories and smiling patients covers most homepage needs, and you should use real team photos anyway.",
  },
  {
    question: "Is a dentist considered a HIPAA covered entity?",
    answer:
      "Yes. A dental practice that transmits any health information electronically in connection with a standard HIPAA transaction (for example, electronic claims to insurance) is a covered entity under the HIPAA Privacy and Security Rules. See the HHS guidance at https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html and the ADA's HIPAA resources at https://www.ada.org/resources/practice/legal-and-regulatory/hipaa.",
  },
  {
    question: "What schema markup should a dental practice use?",
    answer:
      "Use the schema.org Dentist type (a subtype of LocalBusiness and MedicalBusiness) for your practice and its locations, with fields for name, address, telephone, url, openingHours, image, and priceRange. Add a Person record for each practitioner with their jobTitle and credentials. Use FAQPage markup on any page that has a frequently-asked-questions section. Supportsheep emits basic section-appropriate JSON-LD, notably a Reviews schema when a page displays reviews; richer Dentist-specific JSON-LD with every practitioner and a FAQPage graph are usually hand-written JSON inside Supportsheep's Code section, which is a plan-gated feature.",
  },
  {
    question: "What do dental website accessibility rules require in 2026?",
    answer:
      "Healthcare providers that receive federal financial assistance must meet WCAG 2.1 Level AA under HHS Section 504 rules, with phased compliance dates running through 2026 and 2027 based on organisation size. Independent of the federal rule, ADA Title III lawsuits against small-business websites have risen year over year and dental practices have been specific targets. Building to WCAG 2.1 AA and keeping a dated audit record is the practical standard. The W3C's WCAG 2.1 quick reference at https://www.w3.org/WAI/WCAG21/quickref/ is the authoritative checklist.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1800) {
    throw new Error(
      `[pilot:dentists:rewrite] content is ${wordCount} words -- below the 1800-word Tier-3 floor`,
    );
  }
  if (wordCount > 2500) {
    throw new Error(
      `[pilot:dentists:rewrite] content is ${wordCount} words -- above the 2500-word Tier-3 ceiling`,
    );
  }

  const ref = collections.programmaticPages().doc(DOC_ID);
  const existing = await ref.get();

  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      collection: "for",
      variantKey: VARIANT_KEY,
      variables: {
        subhead:
          "A practical guide to building a dental practice website that wins local search, clears HIPAA and accessibility requirements, and does not eat your evenings -- with an honest read of where Supportsheep fits and where it does not.",
        ctaText: "Start your dental practice website",
        ctaHref: "https://supportsheep.com",
      },
      title: "Supportsheep for dentists",
      metaDescription:
        "Supportsheep helps supportsheep and small dental practices (1-5 dentists) launch a fast, mobile-first, SEO-aware brochure site. It is not HIPAA-BAA-ready, so pair it with a HIPAA-aware booking and intake tool.",
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
    `[pilot:dentists:rewrite] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/for/dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:dentists:rewrite] failed:", err);
    process.exit(1);
  });
