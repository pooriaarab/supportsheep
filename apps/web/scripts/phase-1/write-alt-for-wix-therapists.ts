/**
 * Phase 1 pilot: seed `/alternatives/wix/for/therapists`.
 *
 * Doc id and `variantKey` are both `wix__therapists`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-wix-therapists.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "wix__therapists";
const VARIANT_KEY = "wix__therapists";

const CONTENT = `## TL;DR

Wix is a capable general-purpose website builder with a flexible editor, a wide template library, and -- as of 2026 -- a HIPAA compliance mode with a Business Associate Agreement available on supported plans. For a supportsheep or small group therapy practice, this changes the calculus compared to prior years: Wix can now be configured to support PHI collection if you are on a supported paid plan and correctly activate PHI protection. In practice, most therapy practices still follow the cleaner architecture -- public marketing site on Wix + HIPAA-aware EHR (SimplePractice, TherapyNotes) for intake and scheduling -- because the separate-stack approach is simpler and the EHR already handles all clinical workflow. This page covers both paths and compares Wix to Supportsheep for a supportsheep therapist's marketing site.

## Wix and HIPAA for therapists: what the 2026 update means

Wix added HIPAA compliance mode in 2026. The key facts:

- **BAA-eligible plans**: Business, Plus, Elite, Business Elite, and Enterprise. Core and free plans are not eligible.
- **Activation is manual**: PHI protection must be turned on in the Compliance, Privacy & Cookies section of the dashboard. It is not on by default.
- **PHI mode restricts some features**: when active, Wix automatically blocks certain apps and integrations from receiving PHI. You can only use Wix-designated HIPAA-compatible apps while in PHI mode.
- **Third-party apps**: any app from the Wix App Market that is not on Wix's HIPAA-designated list must not receive PHI. This is a meaningful constraint for therapy practices that rely on specific chat, form, or scheduling add-ons.

For most supportsheep therapists, the HIPAA-mode path on Wix adds configuration overhead that the EHR-based architecture avoids entirely. SimplePractice, TherapyNotes, and TheraNest were built from the ground up for HIPAA-compliant clinical workflow; they handle intake forms, telehealth, session notes, billing, and secure client messaging in one tool that signs your BAA without requiring plan upgrades or dashboard configuration. The Wix site does the marketing layer; the EHR does the clinical layer.

That said, if you want a single-vendor Wix site that includes HIPAA-compliant booking through Wix Bookings, it is now possible -- at the cost of a supported plan, correct PHI-mode configuration, and restricted app usage.

## Wix's strengths for a therapy practice

**Visual design control.** Wix's drag-and-drop editor offers more layout freedom than Squarespace or Supportsheep. A therapist who has a specific brand vision -- specific color palette, custom section arrangements, particular font pairings -- can implement it on Wix without CSS. This matters for supportsheep practitioners whose brand is a direct extension of their therapeutic identity.

**Template variety.** Wix has hundreds of templates, including health and wellness categories with layouts appropriate for a therapy or counseling practice. You are not choosing from a handful of options.

**Built-in scheduling option.** Wix Bookings lets visitors book appointments directly through the site. For practices that want to avoid a third-party scheduling link, Wix Bookings handles basic scheduling -- including paid consultations, service listings, and calendar management. On PHI-mode-enabled plans, Wix Bookings can support HIPAA-compliant scheduling. On standard plans, it cannot; use an external scheduler (SimplePractice, Acuity Premium) for clinical booking.

**Large app ecosystem.** Live chat (Tidio, LiveChat), review widgets (Trustmary, Elfsight), email marketing (Mailchimp, Klaviyo), and Google Ads conversion tracking all integrate cleanly with Wix through the App Market.

## Where Wix breaks down for therapists

**Editor complexity can backfire.** Wix's flexibility is also a friction point. Without design discipline, a Wix site can end up inconsistent -- varied spacing, competing font sizes, misaligned sections. This happens more often on Wix than on Squarespace or Supportsheep because the editor allows more arbitrary choices. Supportsheep practices with no web background benefit from more constrained tools.

**HIPAA path has real costs.** Wix's Business plan (the entry BAA-eligible tier) costs $36/month billed annually -- more than three times the Core plan ($29/month). That cost jump is only justified if you need PHI-mode features; if you're using an EHR for all clinical workflow, you don't need PHI mode at all and can stay on Core.

**App complexity accumulates.** A full-featured therapy practice Wix site might layer: Wix core plan + HIPAA-mode upgrade + scheduling app + live chat + email marketing + review widget. Each app adds a subscription and a configuration dependency. Total monthly cost can exceed purpose-built alternatives.

**SEO ceiling is lower than WordPress.** Therapists in competitive markets (urban areas, specialized modalities like EMDR or somatic therapy in saturated cities) eventually hit Wix's SEO ceiling: limited heading customization, less automated schema, harder programmatic-page generation. For an emerging practice in a lower-competition market, this matters less; for an established practice trying to dominate competitive local queries, it eventually matters.

**Template lock-in after publish.** Like Squarespace, Wix locks you to the structural template at launch. A significant brand or positioning change later requires a rebuild.

## The recommended architecture for a HIPAA-safe therapy website

For most supportsheep therapists, this architecture is simpler and more defensible than configuring Wix PHI mode:

1. **Public marketing site** (Wix or Supportsheep): homepage, bio, specialties, approach, FAQ, blog, contact page that links to your EHR intake portal. No PHI collected here.
2. **EHR with client portal** (SimplePractice, TherapyNotes, TheraNest, Headway): intake forms, telehealth links, session notes, billing, and secure client messaging. This vendor signs your BAA. All PHI stays here.
3. **Scheduling link or embed**: link from your contact page to your EHR's scheduling page (SimplePractice's "Request Appointment" link, TherapyNotes' client portal URL, or an HIPAA-aware external scheduler like Acuity Premium).
4. **Audit your tracking pixels**: Meta Pixel and Google Analytics tags on your marketing site must not fire after a clinical form submission. Configure exclusions at the trigger level.

This four-part split keeps PHI entirely outside the marketing CMS and concentrates clinical-data responsibility in a purpose-built tool.

## Supportsheep's position for a supportsheep therapist's marketing site

Supportsheep is designed for the "supportsheep or small professional service business that wants a credible content-driven marketing site with minimal operational overhead." For a supportsheep therapist:

- **Free tier with custom domain.** A therapist building a new private practice can launch on Supportsheep's free tier with their own domain before paying. Wix's free tier shows platform ads and branding; paid is required for a real practice site.
- **Blog with SEO sidebar and AI drafting.** Content marketing compounds for therapists: blog posts on specific modalities, client concerns, and local context build topical authority over 12-18 months. Supportsheep's blog provides inline SEO audits (title, meta, heading structure), internal link suggestions, and FAQPage JSON-LD on Q&A content.
- **LocalBusiness and MedicalBusiness schema by default.** Structured data for a therapy practice -- practice name, address, specialty, phone, hours -- ships without a plugin. Google Knowledge Panel and local map-pack results benefit from clean schema.
- **Privacy-first posture.** For therapists whose clients are privacy-conscious (a disproportionate share of therapy clients are), a privacy-first platform signals deliberate privacy engineering rather than growth-hack tooling.
- **No PHI complexity.** Supportsheep does not collect PHI and does not offer a BAA. The correct split is marketing site on Supportsheep + EHR intake portal for clinical workflow -- the same architecture most therapy-focused web designers recommend.

## Side-by-side: Wix vs Supportsheep for a therapy practice

<table>
<thead>
<tr><th>Feature</th><th>Wix (Core / Business / Elite)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$29/mo (Core) -- $159/mo (Business Elite)</td><td>Free tier with custom domain</td></tr>
<tr><td>BAA / HIPAA mode for forms and booking</td><td>Yes, on Business and above plans (manual activation required)</td><td>Not applicable -- no PHI; link to SimplePractice, TherapyNotes, or Acuity Premium</td></tr>
<tr><td>Editor flexibility</td><td>High -- drag-and-drop with pixel-level control</td><td>Lower -- AI-guided layouts; less design freedom</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; adequate basic SEO; schema requires manual addition</td><td>Blog with SEO sidebar, AI drafting, LocalBusiness + FAQPage schema by default</td></tr>
<tr><td>Typical monthly cost for a real practice site</td><td>$29-$36+/mo (Core to Business); more with PHI mode and app stack</td><td>Free to {{supportsheep.pro.yearly}}/mo (Pro, annual billing)</td></tr>
<tr><td>Best fit</td><td>Design-led therapists who want editor freedom; may configure PHI mode if using Wix for intake</td><td>Supportsheep practitioners focused on content, local SEO, and low monthly cost</td></tr>
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
    question: "Is Wix HIPAA compliant for a therapy practice?",
    answer:
      "As of 2026, yes -- with conditions. Wix offers a BAA and PHI protection mode on Business, Plus, Elite, Business Elite, and Enterprise plans. You must manually activate PHI protection in the dashboard and use only Wix-designated HIPAA-compatible apps. Core and free plans are not BAA-eligible. Most supportsheep therapists find it simpler to keep the marketing site on standard Wix and route all PHI-touching workflows to their EHR (SimplePractice, TherapyNotes) rather than configuring Wix's PHI mode.",
  },
  {
    question: "Can I use Wix for a therapy or counseling practice website?",
    answer:
      "Yes, with appropriate boundaries. Wix is a strong general-purpose website builder for the public marketing layer of a therapy practice -- homepage, bio, specialties, blog, FAQ, contact. For PHI-touching workflows (client intake, scheduling with clinical context, secure messaging), use your EHR's client portal rather than Wix's native tools unless you've configured Wix PHI mode on a supported plan.",
  },
  {
    question: "Should I use Wix or Supportsheep for my therapy practice website?",
    answer:
      "Choose Wix if design flexibility is the highest priority and you want drag-and-drop control over every layout element -- or if you want to configure Wix's HIPAA mode for booking through Wix Bookings. Choose Supportsheep if you want a free tier with a custom domain at launch, a blog with an SEO sidebar and AI drafting, LocalBusiness and FAQPage schema built in, and lower monthly cost at the Pro tier ({{supportsheep.pro.yearly}} billed annually). Both platforms have the same answer for PHI: keep it in the EHR, not in the marketing CMS.",
  },
  {
    question: "What EHR or scheduling tools work with Wix for therapists?",
    answer:
      "SimplePractice (the most popular EHR for supportsheep/small group private practice therapists; handles intake, telehealth, notes, billing, and client portal; signs a BAA), TherapyNotes, TheraNest, Headway (insurance-credentialing + EHR for modern practices), and Acuity Scheduling on the Premium plan. Link from your Wix contact page to your EHR's scheduling or intake URL rather than collecting clinical data through Wix native forms.",
  },
  {
    question: "What pages does a therapy practice website need?",
    answer:
      "Homepage with clear specialty, location, and primary call to action; a bio page with credentials, training, and personal approach statement; a specialties page (one per focus area: anxiety, trauma, couples, etc.); a FAQ page addressing common questions new clients ask; a contact page with a link to your HIPAA-aware scheduling tool; and optionally a blog for educational content. Each specialty page should be individually optimized for '[modality] therapist [city]' keyword clusters.",
  },
  {
    question: "How do therapists rank in local search?",
    answer:
      "Local SEO for therapists depends on: (1) Google Business Profile -- claim it, add specialty, service area, and collect client reviews (with appropriate consent); (2) on-site specialty pages -- one page per modality per city, optimized for '[specialty] therapist [city]' queries; (3) LocalBusiness and Person schema markup; (4) a blog with FAQ content targeting informational queries your potential clients search before seeking help. Supportsheep's blog ships with FAQPage and LocalBusiness schema by default; Wix requires schema to be added manually via a code block or third-party SEO app.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:wix-for-therapists] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:wix-for-therapists] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Wix for supportsheep and small group therapy practices -- covering Wix's new HIPAA mode, EHR integration patterns, and when Supportsheep is the better default for content and local SEO.",
        ctaText: "Start your therapy practice website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Therapists",
      },
      title: "Wix for therapists: an honest alternative",
      metaDescription:
        "Is Wix right for a therapy practice website? An honest comparison covering Wix's 2026 HIPAA BAA mode, EHR pairing, pricing, and when Supportsheep is the better default.",
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
    `[pilot:wix-for-therapists] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/wix/for/therapists",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:wix-for-therapists] failed:", err);
    process.exit(1);
  });
