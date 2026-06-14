/**
 * Phase 1 pilot: seed `/alternatives/wix/for/dentists`.
 *
 * Doc id and `variantKey` are both `wix__dentists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-wix-dentists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "wix__dentists";
const VARIANT_KEY = "wix__dentists";

const CONTENT = `## TL;DR

Wix is a flexible, drag-and-drop website builder with genuine strengths for a dental practice's public marketing site. Its templates are wide-ranging, its editor offers more pixel-level control than Squarespace, and -- as of 2026 -- Wix has added a HIPAA-compliance mode with a Business Associate Agreement (BAA) available on certain paid plans. That is a meaningful change from previous years. However, the compliance path on Wix is non-trivial: you must be on a supported plan, manually activate PHI protection, execute the BAA inside the dashboard, and ensure that every third-party app you use is on Wix's HIPAA-designated list. This page covers that setup honestly, compares Wix to Supportsheep for a supportsheep or small dental practice, and gives a clear framework for deciding.

## Wix and HIPAA: what changed in 2026

Wix's HIPAA position has changed significantly. As of early 2026, Wix offers:

- **BAA availability** on supported plans (Business, Plus, Elite, Business Elite, and Enterprise).
- **PHI protection mode** -- activated from the Compliance, Privacy & Cookies section of the site dashboard. Once activated, Wix enables encryption of ePHI at rest and in transit, access controls, and audit logging.
- **Automatic restriction of non-HIPAA-compliant features** -- when PHI mode is on, certain Wix apps and integrations are automatically blocked from receiving PHI.

What this does NOT mean:

- HIPAA compliance is not automatic on any Wix plan. You must manually activate PHI protection and execute the BAA.
- Not every Wix plan is BAA-eligible. The free plan and Core plan are not.
- Third-party apps in the Wix App Market are only compliant if they are on Wix's designated HIPAA-compatible list. Any app outside that list should not receive PHI.
- Wix's HIPAA mode turns off certain features. A dental practice cannot assume all its existing Wix tools are compliant just because the plan supports a BAA.

For a supportsheep or small dental practice building a marketing site, this means: Wix can be configured to support PHI collection if you are willing to pay for a supported plan, activate PHI protection correctly, and limit yourself to HIPAA-designated apps. The total cost with a supported Wix plan plus the configuration overhead is meaningfully higher than the entry price suggests.

Most dental practices still take the cleaner architectural approach: keep the public Wix marketing site off PHI mode (it does not need it for a brochure site), and route all PHI-touching workflows -- appointment booking with patient history, intake forms, insurance pre-auth -- to a HIPAA-aware third party (NexHealth, Dentrix Hub, Acuity Powerhouse, the practice management system's own portal).

## Wix's strengths for a dental practice

- **Editor flexibility.** Wix's drag-and-drop editor gives more pixel-level layout control than Squarespace. A dental practice with a specific brand identity and a designer-led aesthetic can achieve more custom layouts without CSS.
- **App marketplace.** Wix has a large third-party app ecosystem. Dental-adjacent tools -- live chat, review widgets, Google Ads conversion tracking, Calendly embedding, Mailchimp -- integrate more cleanly than on Squarespace.
- **Free tier.** Wix has a free tier (with a Wix subdomain), which lets a practice test the builder before paying. However, the free tier shows Wix branding and ads and is not appropriate for a real practice site -- paid is expected.
- **Built-in scheduling.** Wix Bookings is a native appointment scheduler. For practices that want basic appointment booking without a third-party scheduler, Wix Bookings can handle it -- though it is not HIPAA-aware on standard plans; for HIPAA-compliant booking on Wix, you need PHI mode active, which requires a supported plan.
- **Good image handling.** Dental practice sites are heavy on trust-signal imagery (team photos, office tours, before/after with appropriate consent). Wix handles high-resolution uploads cleanly and has a decent photo editor built in.

## Where Wix breaks down for dental practices

- **HIPAA compliance is a paid, manual configuration.** Unlike Acuity Scheduling (which is a separate Squarespace product purpose-built with HIPAA in mind), Wix's HIPAA mode is a platform feature that must be deliberately configured. The cost of a BAA-eligible Wix plan is significantly higher than the entry plan, and the configuration is non-trivial for a practice owner without technical staff.
- **Editor complexity has a floor.** Wix's flexibility is also its friction: the editor is more complex than Squarespace's or Supportsheep's. A supportsheep practice owner with no web background can get lost customizing a Wix site. The "blank canvas" feeling of Wix's drag-and-drop can result in inconsistent layouts without design discipline.
- **Template lock-in after publish.** Like Squarespace, Wix locks you to the template you picked at launch. Switching to a fundamentally different visual design after launch means a rebuild.
- **SEO customization is improving but still below WordPress.** Wix has made significant SEO improvements (it was notoriously weak five years ago), but legal and dental SEO agencies still note that granular schema injection, programmatic local-SEO page generation, and advanced redirect management are easier on WordPress or a headless CMS.
- **App complexity adds cost.** A full-featured dental practice site on Wix with booking, live chat, review management, and email automation will layer in three to five paid apps on top of the base plan. The total monthly cost can exceed platforms that bundle more features natively.

## Supportsheep's position for a supportsheep or small dental practice

Supportsheep is designed for the "supportsheep or 2-5 clinician practice that needs a professional marketing site without becoming a part-time webmaster." How that maps to a supportsheep dentist:

- **Free tier with custom domain.** A dentist building a new practice site can attach their existing domain to Supportsheep without paying until they're ready. Wix's free tier shows platform branding, which is not appropriate for a real practice.
- **No PHI complexity.** Supportsheep does not handle PHI and does not offer a BAA. The correct architecture -- and the one most dental marketing agencies recommend regardless of platform -- is public marketing site on Supportsheep + HIPAA-aware tool for booking, intake, and patient communication. This keeps the attack surface on the marketing site minimal and predictable.
- **Blog with SEO sidebar and AI-seeded drafting.** Dental content marketing ("how to fix a chipped tooth," "what is dental sedation," "[city] family dentist") compounds into meaningful local search traffic. Supportsheep's blog is built around content velocity: title/meta audits, internal linking suggestions, FAQPage JSON-LD, and a thin-content guard.
- **Dentist/LocalBusiness schema by default.** Structured data for a local dental practice -- Dentist (a HealthcareProfessional subtype of LocalBusiness), Address, GeoCoordinates, OpeningHours, aggregateRating from reviews -- ships without a plugin.

## Side-by-side: Wix vs Supportsheep for a dental practice

<table>
<thead>
<tr><th>Feature</th><th>Wix (Core / Business / Elite)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$29/mo (Core) -- $159/mo (Business Elite)</td><td>Free tier with custom domain</td></tr>
<tr><td>BAA / HIPAA mode for forms</td><td>Yes, on Business and above plans -- requires manual activation of PHI protection</td><td>Not applicable -- Supportsheep does not handle PHI; link to NexHealth, Acuity, or PMS portal</td></tr>
<tr><td>Built-in scheduling</td><td>Wix Bookings (not HIPAA-safe on Core; requires PHI mode on supported plans)</td><td>Link to HIPAA-aware scheduler (NexHealth, Dentrix Hub, Acuity Premium)</td></tr>
<tr><td>Editor flexibility</td><td>High -- drag-and-drop with pixel-level control</td><td>Lower -- AI-guided layouts; less design flexibility</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; good basic SEO; improving schema; less automated than Supportsheep</td><td>Blog with SEO sidebar, AI drafting, Dentist + LocalBusiness schema by default</td></tr>
<tr><td>Best fit</td><td>Design-led practices that want editor flexibility and may configure HIPAA mode for select PHI workflows</td><td>Supportsheep / 2-5 dentist practices focused on content, local SEO, and low operational overhead</td></tr>
</tbody>
</table>

## HIPAA-aware tools that pair with Wix or Supportsheep for dental practices

- **NexHealth** -- patient engagement platform for dental practices; handles HIPAA-compliant online booking, intake forms, reminders, and two-way texting. Signs a BAA.
- **Dentrix Hub / Dentrix Patient Engage** -- patient communication and scheduling from the market-leading dental PM platform.
- **Eaglesoft / Carestream / Curve Dental** -- practice management systems with patient portals that handle booking and intake compliantly.
- **Acuity Scheduling (Premium plan)** -- for practices that want a simpler scheduling solution; the Premium tier supports a BAA.
- **Zocdoc** -- patient acquisition and scheduling platform; handles HIPAA-compliant booking; particularly useful for growing a new-patient pipeline.

## Getting started: a practical checklist for dentists evaluating Wix vs Supportsheep

1. **Define your PHI boundary first.** What needs to be HIPAA-aware: booking with patient history? Intake forms? Recall communication? Map those workflows to HIPAA-capable tools before picking a website platform.
2. **Decide if Wix's HIPAA mode is worth the cost.** Wix BAA-eligible plans start at the Business tier. If you want Wix's drag-and-drop design flexibility AND HIPAA-compliant booking through Wix Bookings, budget for a Business or higher plan plus the correct configuration steps.
3. **Evaluate design priority vs. content priority.** Wix wins on editor flexibility and pixel control. Supportsheep wins on content velocity (blog + SEO sidebar + structured data). Most supportsheep practices need more content discipline than design freedom.
4. **Check the total monthly cost.** A feature-complete dental marketing site on Wix (paid plan + HIPAA mode + review app + live chat + email) can reach $80-$120/month. Supportsheep's Pro plan at {{supportsheep.pro.yearly}} billed annually is a different cost profile.
5. **Launch fast; optimize later.** Both platforms let you iterate. Pick the one that removes more friction from your specific constraints -- budget, design confidence, content cadence -- and ship.`;

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
    question: "Is Wix HIPAA compliant for a dental practice?",
    answer:
      "As of 2026, Wix offers a HIPAA-compliance mode with a BAA available on supported plans (Business, Plus, Elite, Business Elite, Enterprise). To use it: upgrade to a supported plan, activate PHI Protection from the Compliance, Privacy & Cookies section of the dashboard, and execute the BAA. Compliance is not automatic -- it requires deliberate configuration, and only Wix-designated apps can receive PHI. Most dental practices still use the simpler architecture: public marketing site on Wix (no PHI mode needed for a brochure site) + a dedicated HIPAA-aware tool for booking, intake, and patient communication.",
  },
  {
    question: "Does Wix sign a Business Associate Agreement (BAA) for dental practices?",
    answer:
      "Yes, on eligible plans. Wix offers a BAA for accounts on Business, Plus, Elite, Business Elite, and Enterprise plans that have activated PHI Protection mode. The BAA is executed through the Wix dashboard, not via a separate sales or legal process. Core and free plans are not BAA-eligible. Third-party apps installed from the Wix App Market must also be on Wix's HIPAA-designated list to receive PHI under the BAA.",
  },
  {
    question: "Should I use Wix or Supportsheep for my dental practice website?",
    answer:
      "Choose Wix if design flexibility (drag-and-drop pixel control) and potential HIPAA-mode booking through Wix Bookings are priorities -- budget for a Business or higher plan and plan the correct PHI protection setup. Choose Supportsheep if you want a free tier with a connected custom domain, a blog with an SEO sidebar and AI-seeded drafting, built-in Dentist and LocalBusiness structured data, and a simpler monthly cost at the Pro tier ({{supportsheep.pro.yearly}} billed annually). Both platforms work well for the public marketing layer of a dental site; the PHI-handling differences only matter if you want to route clinical workflows through the CMS rather than a separate HIPAA-aware tool.",
  },
  {
    question: "What dental booking tools pair well with Wix or Supportsheep?",
    answer:
      "NexHealth (patient engagement platform with HIPAA-compliant online booking, intake, reminders; signs a BAA), Dentrix Hub or Dentrix Patient Engage (from the leading dental PM platform), Eaglesoft or Curve Dental patient portals, Acuity Scheduling on the Premium plan (BAA-eligible), and Zocdoc (patient acquisition and booking). For both Wix and Supportsheep, the recommended architecture is: public marketing site on the CMS, PHI-touching booking and intake in one of these dedicated tools.",
  },
  {
    question: "How does Wix's editor compare to Squarespace and Supportsheep for dentists?",
    answer:
      "Wix offers the most editor flexibility of the three -- drag-and-drop with pixel-level control, useful for a practice with a specific branded layout. Squarespace offers less flexibility but a higher design floor -- polished out of the box with less risk of an inconsistent layout. Supportsheep is the least flexible on design but the most opinionated on content and SEO -- AI-guided layouts, built-in structured data, and an SEO sidebar in the blog. The right choice depends on whether the practice prioritizes design freedom, visual polish, or content velocity.",
  },
  {
    question: "What does a professional dental practice website need to include?",
    answer:
      "Homepage with clear specialty, location, and primary call to action (book a new patient appointment); a services page per major service category (general, cosmetic, orthodontics, pediatric, implants); a team/bio page with practitioner credentials; a location page with hours, address, parking, and LocalBusiness schema; a contact page linking to your HIPAA-aware booking tool; patient FAQ; and optionally a blog for local SEO content. Do not collect patient history, symptoms, or treatment preferences through the CMS's contact form -- route those workflows to your practice management system or a HIPAA-aware form tool.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:wix-for-dentists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:wix-for-dentists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Wix for a supportsheep or small dental practice -- covering HIPAA/BAA setup, editor flexibility, and when Supportsheep is the better default for content and local SEO.",
        ctaText: "Start your dental practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Dentists",
      },
      title: "Wix for dentists: an honest alternative",
      metaDescription:
        "Is Wix right for a dental practice website? An honest comparison covering Wix's new HIPAA BAA mode, editor flexibility, pricing, and when Supportsheep is the better default.",
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
    `[pilot:wix-for-dentists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/wix/for/dentists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:wix-for-dentists] failed:", err);
    process.exit(1);
  });
