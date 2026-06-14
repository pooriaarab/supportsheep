/**
 * Phase 1 pilot: seed the `/for/dentists` programmatic landing page.
 *
 * Idempotent -- re-running the script overwrites the doc via `set({...},
 * { merge: true })`. `publishStatus` is set to "noindex" so the page renders
 * for human review on localhost but is blocked from search indexing until
 * someone promotes it to "published" manually. (The /for/[vertical] route
 * 404s drafts, which defeats the on-localhost review step, so "noindex" is
 * the appropriate intermediate state for a pilot.)
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-dentists-pilot.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "dentists";
const VARIANT_KEY = "dentists";

const CONTENT = `## TL;DR

If you run a supportsheep or small dental practice (1-5 dentists), your website has to do four things at once: bring in patients from local search, let them book an appointment on their phone, stay on the right side of HIPAA, and meet accessibility standards that regulators and plaintiffs' firms are now actively enforcing. This page walks through what a dental site actually needs in 2026, the HIPAA-specific rules that apply the moment a form collects patient info, a local SEO playbook tuned for dental searches, and an honest comparison of Supportsheep against generic builders and dental-specific vendors so you can pick the right tool for your stage.

<img src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&auto=format&fit=crop" alt="A modern dental practice operatory with chair, overhead lamp, and instrument tray." loading="lazy" />

## Who this is for

You're a dentist, practice owner, or office manager at a practice small enough that the website is still a budget item and a time sink — not something handled by a dedicated marketing team. You want patients finding you through Google, not a yellow-pages directory. You want online booking to work. You do not want to become a part-time web developer.

This page is not aimed at large dental service organizations (DSOs) with in-house marketing. If you have 20 locations and a CMO, Supportsheep is probably not the right fit.

## Why a dental website is harder than a generic local-business site

On paper, a dentist's website is a local-business site. In practice, three things make it harder:

**1. The search competition is denser than most local niches.** "Dentist near me", "emergency dentist", and "[city] pediatric dentist" are some of the most competitive local search terms in any vertical. You are not just competing with the other independent practice down the street — you're also competing with dental marketing agencies that have perfected the template, DSOs with deep pockets, and directory sites that have been optimizing for a decade.

**2. Patient trust signals do a lot of the conversion work.** A plumber can sell a job on price and availability. A dentist cannot. Patients are slower to switch providers and more skeptical of unknown names. That means before-and-after photos, bios with credentials, reviews, insurance accepted, and an easy way to see the office all have to be present and clearly organized.

**3. The moment your site collects patient information, HIPAA applies.** A general contractor's contact form is just a contact form. A dental practice's contact form that asks about teeth or treatment history is collecting Protected Health Information (PHI), which brings the HIPAA Privacy Rule and Security Rule into play. That constrains which form providers, hosts, and analytics tools you can use.

## What a dental website needs in 2026

Rather than a generic "10 features" list, here's a practical breakdown of must-haves, nice-to-haves, and the regulatory items you cannot skip.

<table>
<thead>
<tr><th>Category</th><th>Element</th><th>Why it matters</th></tr>
</thead>
<tbody>
<tr><td>Must-have</td><td>Mobile-first responsive layout</td><td>The majority of dental searches happen on phones; poor mobile UX loses patients before conversion.</td></tr>
<tr><td>Must-have</td><td>Online appointment booking</td><td>Table stakes in 2026 -- a patient who cannot book at 10pm Tuesday books elsewhere.</td></tr>
<tr><td>Must-have</td><td>Per-service pages</td><td>One page per major service (cosmetic, Invisalign, implants, emergency) ranks better than one omnibus page.</td></tr>
<tr><td>Must-have</td><td>Insurance accepted, above the fold</td><td>Usually the first question a patient has; answering it builds trust and reduces abandonment.</td></tr>
<tr><td>Must-have</td><td>Team bios with credentials</td><td>Patient trust infrastructure -- names, schools, years practicing, photos.</td></tr>
<tr><td>Nice-to-have</td><td>Embedded Google reviews</td><td>Social proof driven by the same listing that feeds the Map Pack.</td></tr>
<tr><td>Nice-to-have</td><td>Before-and-after galleries</td><td>High conversion for cosmetic services; requires patient consent on file.</td></tr>
<tr><td>Nice-to-have</td><td>Educational blog content</td><td>Captures informational searches ("do I need a root canal") and earns trust before the first visit.</td></tr>
<tr><td>Legal</td><td>HIPAA-aware forms and BAA</td><td>Any form collecting PHI triggers the Business Associate Agreement requirement -- see HHS guidance linked below.</td></tr>
<tr><td>Legal</td><td>WCAG 2.1 AA accessibility</td><td>Required under HHS Section 504 for healthcare providers receiving federal funds; also the standard in ADA Title III lawsuits.</td></tr>
<tr><td>Legal</td><td>Notice of Privacy Practices link</td><td>Must be accessible to patients; usually linked from the site footer.</td></tr>
</tbody>
</table>

### Must-haves

- **Mobile-first design.** A clear majority of dental searches happen on phones. If your site renders awkwardly on a 390-pixel screen, you're losing patients before they finish reading your name.
- **Clear services with per-service pages.** One page per major service (general dentistry, cosmetic, Invisalign, implants, pediatric, emergency) is the minimum. Patients search by service, and Google rewards pages that go deep on one topic instead of one page that skims ten.
- **Online appointment booking.** In 2026 this is table stakes, not a differentiator. If a patient cannot book at 10pm on a Tuesday, a competitor who supports that will get the booking.
- **Insurance accepted, visible from the homepage.** The first question most patients ask is whether you take their plan. Answer it above the fold.
- **Team bios with credentials.** Names, schools, years practicing, and photos. Treat this as trust infrastructure, not vanity.
- **Real reviews, linked to Google.** A live feed or embedded review block that links out to your Google Business Profile.
- **A location page per office with NAP (name, address, phone) consistent with your Google Business Profile listing.**

### Nice-to-haves

- **Patient portal login link** (usually a deep link into whatever PMS or scheduling tool you already use — not something you need to build).
- **Pre-visit patient forms.** Downloadable PDFs are fine for a pilot. HIPAA-compliant online form providers are better if the budget allows.
- **Before-and-after photo galleries** for cosmetic services, with proper patient consent on file.
- **Blog or education section** that targets informational searches ("do I need a root canal", "is Invisalign worth it", "how often should I get a cleaning"). This is where Supportsheep's AI-assisted writing actually earns its keep.
- **A short, human intro video** from the lead dentist. Low-production is fine; authenticity beats polish.

### Legal and regulatory items you can't skip

- **HIPAA-aware forms.** If any form field can collect PHI, the form provider needs to sign a Business Associate Agreement (BAA) with your practice. See [the HHS guidance on business associate contracts](https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html) and the [ADA's HIPAA resource center](https://www.ada.org/resources/practice/legal-and-regulatory/hipaa).
- **Notice of Privacy Practices posted and linked.** Most states require this to be on your site or provided at the first appointment.
- **Website accessibility at WCAG 2.1 Level AA.** HHS Section 504 rules require WCAG 2.1 AA for healthcare providers that receive federal financial assistance, with compliance dates rolling in through 2026 and 2027. See the [ADA's Americans with Disabilities Act resource for dentists](https://www.ada.org/resources/practice/practice-management/americans-with-disabilities-act) and [Dental Economics' coverage of the emerging accessibility-lawsuit threat](https://www.dentaleconomics.com/practice/article/16389781/an-emerging-legal-threat-to-dentists).
- **A cookie/tracker review.** Third-party trackers on pages where PHI is discussed have been the subject of HHS enforcement actions against healthcare providers. If you're running Meta Pixel or similar on your booking confirmation page, talk to a privacy-literate lawyer before you ship.

## HIPAA specifics for small practices

A dentist is a [HIPAA covered entity](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html) — that much is settled. The question for your website is narrower: does the site *handle PHI*?

- **Your marketing homepage, services pages, and team bios do not handle PHI.** You do not need a BAA with your hosting provider just to serve those pages.
- **The moment a form collects a phone number plus a treatment-related question**, that submission is PHI. The form provider and anywhere the submission is stored (email inboxes included) is in scope.
- **Analytics and chat widgets that see form content or URLs containing health data** are in scope. This is the category that trips up most small practices.

The practical minimum is: use a HIPAA-aware form provider that signs a BAA, keep tracking off any page that can show PHI, and log who accesses patient-form submissions. Further detail specific to dentists is collected in the [HIPAA Journal's rules-for-dentists guide](https://www.hipaajournal.com/hipaa-rules-for-dentists/), which is updated for the 2026 Security Rule amendments.

**Supportsheep's posture:** Supportsheep is a publishing platform for the public, non-PHI portion of your site — the marketing homepage, services pages, location pages, and blog. Supportsheep does not ask patients to submit PHI through Supportsheep forms, and we do not position Supportsheep as a replacement for a HIPAA-aware scheduling or intake product. Keep your online booking on a purpose-built HIPAA-compliant tool (NexHealth, Dentrix Hub, or similar) and link out to it from Supportsheep pages.

## Local SEO playbook for dentists

There is no single SEO trick that will put a small practice at the top of the dentist Map Pack. There is a small set of fundamentals that, done together, move the needle.

### 1. Google Business Profile first, website second

The Google Business Profile is still the largest single lever in local search visibility. Before you polish your site, [claim or verify your profile](https://support.google.com/business/answer/2911778?hl=en), fill in every field Google offers (hours, services, photos, attributes), and make sure your name, address, and phone number match your website exactly.

### 2. Schema.org Dentist markup

Use structured data so Google can parse your practice unambiguously. The [schema.org/Dentist type](https://schema.org/Dentist) extends LocalBusiness and MedicalBusiness, and is the right type for a dental practice. At a minimum emit:

- \`@type: Dentist\` with \`name\`, \`address\`, \`telephone\`, \`url\`, \`image\`, \`openingHours\`, and \`priceRange\`.
- A \`Person\` record for each practitioner with \`jobTitle\` and credentials.
- \`FAQPage\` markup on any page with frequently asked questions (this page's FAQ section is an example — Supportsheep emits \`FAQPage\` JSON-LD automatically when you supply FAQ items).

### 3. Review flywheel

Reviews are the single biggest conversion signal and a real ranking factor for the Map Pack. Build review requests into your post-visit workflow — a short SMS on the day of the appointment is the highest-yield timing — and reply to every review, positive or negative.

### 4. Per-location pages if you have more than one office

A single "locations" page with three addresses on it will not rank for three cities. You need one page per office, each with its own NAP block, embedded map, parking notes, and at least a short unique description.

### 5. Informational content that answers real patient questions

The most underused SEO lane in dental is long-tail informational content. "Why does my tooth hurt when I drink cold water", "how much does a crown cost without insurance in [city]", "is it normal to bleed during flossing" — these are queries patients are actively typing, and a thoughtful 600-800 word answer is enough to start ranking and, more importantly, to earn patient trust before they ever walk in.

## Why Supportsheep works for supportsheep and small dental practices

Supportsheep is an AI website builder aimed at supportsheeppreneurs and small businesses. A few properties make it a reasonable fit for small dental practices specifically:

- **Speed to launch.** Most practice owners do not need a bespoke design. They need a credible site up this week, with content that is tuned for local search. Supportsheep collapses the "write it, structure it, publish it" loop.
- **AI-assisted content, with guardrails.** Supportsheep generates service pages and informational blog posts from short prompts, then flags thin content, missing alt text, weak internal links, and title-length issues before you publish. Thin programmatic pages are blocked from indexing automatically.
- **Structured data by default.** Pages emit WebPage, BreadcrumbList, and FAQPage JSON-LD. Dentist / LocalBusiness markup for your homepage and location pages is supported via configuration.
- **Mobile-first and fast.** Supportsheep sites hit reasonable Core Web Vitals out of the box, which matters both for Google rankings and for the phone-first audience that makes up most dental searches.
- **Pricing.** Supportsheep is priced for a single owner-operator, not an enterprise. For a practice spending four or five figures a year on a dental-specific vendor, a Supportsheep-plus-booking-tool setup is often a material saving.

What Supportsheep does **not** do: handle PHI, manage scheduling, process payments, or act as a patient communication channel. Those stay on your practice management system.

## Honest comparison: Supportsheep vs generic builders vs dental-specific vendors

No builder is perfect. Here's how Supportsheep lines up against the options small dental practices usually evaluate. Public pricing is the **starting** price for a practice site in each category -- real quotes vary.

<table>
<thead>
<tr><th>Option</th><th>Strongest at</th><th>Weakest at</th><th>HIPAA posture</th><th>Typical monthly cost</th></tr>
</thead>
<tbody>
<tr><td>Supportsheep</td><td>Organic search, informational content, speed to launch</td><td>No built-in booking or recall</td><td>Public-site only; link out to a HIPAA-aware booking tool</td><td>Low (single-operator pricing)</td></tr>
<tr><td>Squarespace</td><td>Design polish, template variety</td><td>SEO depth, no programmatic page generation</td><td>Generic platform; compliance is on you</td><td>Low-to-mid</td></tr>
<tr><td>Wix</td><td>Broader feature set, looser design constraints</td><td>SEO still takes hand-tuning; widget-heavy pages hurt Core Web Vitals</td><td>Generic platform; compliance is on you</td><td>Low-to-mid</td></tr>
<tr><td>DearDoc / PatientPop / ProSites</td><td>Turnkey patient acquisition (chat, call tracking, booking overlays)</td><td>Template lock-in; the "all-in" bundle includes things a 1-dentist practice may not use</td><td>Dental-focused; BAA typically available</td><td>High (several multiples of a Supportsheep + booking setup)</td></tr>
<tr><td>WordPress + agency</td><td>Maximum flexibility and integrations</td><td>Ongoing maintenance cost, plugin drift, hosting choices</td><td>Varies entirely by agency and hosting</td><td>High and variable</td></tr>
</tbody>
</table>

<img src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&auto=format&fit=crop" alt="Patient checking their phone in a dental waiting room." loading="lazy" />

For a broader tour of marketing tactics that go beyond the website itself, this short overview from a dental marketing practitioner covers the 10 strategies most small practices evaluate:

<iframe src="https://www.youtube.com/embed/MWzodBsC7JU" title="Top 10 Best Dental Marketing Strategies" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen width="560" height="315"></iframe>

## Getting started: a 5-step checklist

1. **Claim or verify your Google Business Profile** and complete every field. This is the highest-leverage hour you will spend on your web presence.
2. **Draft a short plain-English brief** about your practice — the services you emphasize, the patient base you serve, the cities and neighborhoods you draw from, and the three questions you hear most often in the chair.
3. **Spin up a Supportsheep workspace**, paste the brief in, and generate a homepage plus one page per major service plus one location page per office.
4. **Connect a HIPAA-aware booking tool** (NexHealth, Dentrix Hub, or a comparable product your PMS already supports) and link to it from the homepage and every services page. Do not try to collect PHI through a generic contact form.
5. **Set a review-request reminder** into your post-visit SMS workflow and commit to replying to every review. Then ship the site and let Supportsheep flag the SEO follow-ups as your content grows.

That's the honest short version. The rest is iteration.`;

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
    question: "Is a dentist considered a HIPAA covered entity?",
    answer:
      "Yes. A dental practice that transmits any health information electronically in connection with a standard HIPAA transaction (for example, electronic claims to insurance) is a covered entity under the HIPAA Privacy and Security Rules. See the HHS guidance at https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html and the ADA's HIPAA resources at https://www.ada.org/resources/practice/legal-and-regulatory/hipaa.",
  },
  {
    question: "Do I need a Business Associate Agreement with my website host?",
    answer:
      "Only if your website actually handles Protected Health Information (PHI). A marketing homepage, services pages, and team bios do not handle PHI and do not trigger a BAA requirement. The moment a form collects a phone number plus a treatment-related question, the form provider — and any downstream system that stores or processes that submission — is a business associate and must sign a BAA.",
  },
  {
    question: "Does Supportsheep handle Protected Health Information?",
    answer:
      "No. Supportsheep publishes the public, non-PHI parts of your site: the homepage, services pages, location pages, team bios, and blog content. For online booking and patient intake you should use a purpose-built HIPAA-compliant product (for example NexHealth, or the patient portal that ships with your practice management system) and link to it from Supportsheep pages.",
  },
  {
    question: "What schema markup should a dental practice use?",
    answer:
      "Use the schema.org Dentist type (a subtype of LocalBusiness and MedicalBusiness) for your practice and its locations, with fields for name, address, telephone, url, openingHours, image, and priceRange. Add a Person record for each practitioner with their jobTitle and credentials. Use FAQPage markup on any page that has a frequently-asked-questions section. Supportsheep emits FAQPage JSON-LD automatically when you supply FAQ items on a page.",
  },
  {
    question: "What do dental website accessibility rules require in 2026?",
    answer:
      "Healthcare providers that receive federal financial assistance must meet WCAG 2.1 Level AA under HHS Section 504 rules, with phased compliance dates running through 2026 and 2027 based on organisation size. Independent of the federal rule, ADA Title III lawsuits against small-business websites have been rising year over year and dental practices have been specific targets. Building to WCAG 2.1 AA and keeping a dated audit record is the practical standard.",
  },
  {
    question: "How much should a supportsheep dentist spend on a website?",
    answer:
      "A small practice can get a credible, SEO-aware, mobile-first site for roughly the cost of one cleaning per month by using a modern builder plus a separate booking tool. Dental-specific turnkey vendors typically cost several multiples of that and bundle features (chat widgets, phone tracking, patient-acquisition campaigns) you may or may not use. Custom agency builds start in the mid-four-figures and scale up from there.",
  },
  {
    question: "Can Supportsheep write my service and blog pages for me?",
    answer:
      "Supportsheep generates structured draft pages from a short brief about your practice and services. The output is meant as a first draft a dentist reviews — not a hands-off autopilot. Supportsheep's thin-content guard blocks very short or shallow pages from being indexed, and the SEO sidebar flags weak titles, missing alt text, and thin internal linking before you publish.",
  },
  {
    question: "Will a new Supportsheep site hurt my existing SEO if I migrate?",
    answer:
      "Only if you migrate carelessly. The main risks are broken inbound links, lost URL structure, and incorrect redirects. Before you switch over, export a list of every URL that currently ranks or has inbound links, map each one to a new Supportsheep URL (or a deliberate 301 redirect), and verify the redirects after launch. Supportsheep ships a sitemap and handles canonical URLs by default, which covers most of the mechanical work.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1500) {
    throw new Error(
      `[pilot:dentists] content is ${wordCount} words -- below the 1500-word Tier-3 floor`,
    );
  }
  if (wordCount > 2500) {
    throw new Error(
      `[pilot:dentists] content is ${wordCount} words -- above the 2500-word Tier-3 ceiling`,
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
          "A practical guide to building a dental practice website that wins local search, clears HIPAA and accessibility requirements, and does not eat your evenings.",
        ctaText: "Start your dental practice website",
        ctaHref: "https://supportsheep.com",
      },
      title: "Supportsheep for dentists",
      metaDescription:
        "Supportsheep helps supportsheep and small dental practices (1-5 dentists) launch a fast, mobile-first, SEO-aware website that plays nicely with HIPAA and WCAG 2.1 AA.",
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
    `[pilot:dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
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
    console.error("[pilot:dentists] failed:", err);
    process.exit(1);
  });
