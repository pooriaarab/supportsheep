/**
 * Phase 1 pilot: seed `/alternatives/webflow/for/photographers`.
 *
 * Doc id and `variantKey` are both `webflow__photographers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-webflow-photographers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "webflow__photographers";
const VARIANT_KEY = "webflow__photographers";

const CONTENT = `## TL;DR

Webflow is a powerful visual website builder that generates clean, semantic code -- the go-to platform for designers and agencies who want precise layout control without writing every line by hand. For photographers, Webflow is technically capable and produces beautiful, custom portfolio sites. The tradeoffs are steep: a meaningful learning curve (typically 1-3 weeks to become proficient), a pricing structure higher than general-purpose builders, and no native client proofing, gallery delivery, or booking workflow. Webflow is right for a photographer who is also a designer or works with a Webflow agency. It is not the right default for a solo photographer whose time is behind the camera, not the code editor.

## What Webflow actually is

Webflow is a visual development tool that bridges the gap between design and code. As you drag elements and configure properties visually, Webflow generates clean HTML and CSS in the background. The output is not a template -- it is custom code that reflects exactly what you designed. This makes Webflow's ceiling dramatically higher than any template-based builder.

For designers, that ceiling is the product's value proposition. For photographers who are not designers, it is a liability: the same flexibility that enables a custom editorial experience requires design and layout understanding that most photographers do not have or want to develop.

Webflow also has a CMS -- redesigned in 2025 into a significantly more powerful system with reference fields, collection relationships, and granular content control. For a photography studio that wants to manage a large catalog of portfolio work, client stories, and blog posts with precise editorial control, Webflow's CMS is genuinely strong.

## Where Webflow works well for photographers

**Pixel-perfect portfolio design.** If visual design precision is the highest priority -- you want a portfolio that looks exactly like the layouts in your mockup, with specific hover interactions, loading animations, and compositional details -- Webflow delivers this. No template builder matches Webflow's design ceiling.

**Clean code that search engines can parse.** Webflow generates semantic HTML with clean heading structure, properly tagged images, and well-formed metadata. For photographers investing in local SEO, a Webflow-built site gives more granular control over the code layer than any template builder -- including Squarespace and Wix.

**CMS for editorial-rich portfolios.** A commercial or editorial photographer who maintains a large, regularly updated portfolio -- with client tags, campaign categories, agency credits, and publication references -- benefits from Webflow's CMS. The collection system handles this complexity better than Squarespace's portfolio blocks or Wix's gallery pages.

**No template lock-in.** Webflow builds are fully custom. You are not locked to a template's structural decisions. A photographer whose brand evolves dramatically can redesign without a rebuild -- if they have the design skills to do it.

## Where Webflow breaks down for photographers

**Learning curve is significant and real.** Multiple independent reviews and Webflow's own community data put the time to proficiency at 1-3 weeks of focused learning for someone with design experience. For someone without design experience, the curve is steeper and the time longer. Terms like "div blocks," "flexbox," "CMS bindings," and "interaction triggers" are native Webflow concepts. Photographers who want to update their own site after launch need to either learn these concepts or budget for ongoing agency support.

**No native client proofing.** Like Squarespace, Webflow has no built-in client gallery delivery or proofing tool. A photographer using Webflow still needs Pixieset, Pic-Time, CloudSpot, or ShootProof for client delivery. Webflow is the marketing and portfolio surface; the delivery tools handle the client workflow.

**No native booking.** Webflow does not have a scheduling tool. You embed a third-party scheduler (Calendly, Acuity) or add a Webflow CMS-powered inquiry form. Both are doable, but they require configuration.

**Pricing is higher than general-purpose builders.** Webflow's plans for publishing a site start at $14/month (basic) for simple sites, but a photographer who needs the CMS to manage portfolio collections and a blog typically needs the CMS plan ($23/month) or higher. Webflow Ecommerce for print sales starts at $29/month. This is not prohibitive, but it is higher than Wix or BlogBat for comparable functionality.

**Hosting is Webflow-specific.** Webflow exports clean code, but the full feature set (CMS, interactions, forms) only functions on Webflow hosting. This is not a lock-in problem for most photographers, but it is worth knowing.

**Not the right tool for non-designers.** This is the most important limitation. Webflow's value proposition is design precision for people who have design skills. A solo photographer who wants to manage their own website without involving a designer or developer on an ongoing basis is not Webflow's target user. Squarespace, Wix, or BlogBat are better defaults for this use case.

## Who Webflow is actually right for among photographers

Webflow is the right choice for a photographer who:

- **Has design background or works with a Webflow designer.** The investment in a custom Webflow build is justified when the designer can ship a site that looks unlike anything in the Squarespace template library.
- **Needs editorial complexity.** Agencies, commercial photographers, and publication-facing editorial photographers with large, structured portfolios benefit from Webflow's CMS.
- **Wants to own the code.** Webflow generates exportable, portable code. Photographers who want the ability to leave Webflow and take their site code with them have that option.
- **Prioritizes design perfectionism over workflow integration.** Webflow is for photographers who care deeply about the visual experience of the portfolio and are comfortable routing proofing, delivery, and booking to specialist tools.

## BlogBat's position for photographers who don't need Webflow's complexity

BlogBat is designed for the "solo service business that needs a credible marketing site and wants to use content as a primary growth channel." For a photographer who is not a designer:

- **Free tier with custom domain.** A photographer can test BlogBat's free tier with their own domain before paying anything. Webflow's free plan limits publishing; paid is required for a real site.
- **AI-guided onboarding.** BlogBat's onboarding generates a multi-page first draft from a business description, seeding section content with business context. No design decisions required.
- **Blog with SEO sidebar and structured data.** For a photographer whose acquisition channel is local search ("Austin wedding photographer," "Napa engagement session," "[venue] portrait session photos"), a blog with an SEO sidebar, AI drafting, and automated ImageObject + Article + LocalBusiness schema reduces the per-post friction.
- **No learning curve.** BlogBat is designed for non-technical users. There is no div block, no flexbox configuration, no interaction trigger to learn. The trade-off is design precision -- BlogBat is more constrained than Webflow but more approachable.

## Side-by-side: Webflow vs BlogBat for photographers

<table>
<thead>
<tr><th>Feature</th><th>Webflow</th><th>BlogBat</th></tr>
</thead>
<tbody>
<tr><td>Design ceiling</td><td>Highest in class -- pixel-perfect custom layouts with interactions</td><td>Constrained -- AI-guided layouts, consistent but not custom</td></tr>
<tr><td>Learning curve</td><td>Steep -- 1-3 weeks for someone with design background; more for non-designers</td><td>Low -- designed for non-technical users; no design concepts required</td></tr>
<tr><td>Starting price (annual)</td><td>$14/mo (basic, no CMS); $23/mo (CMS); more for ecommerce</td><td>Free tier with custom domain</td></tr>
<tr><td>Native client proofing</td><td>No -- use Pixieset, Pic-Time, or CloudSpot</td><td>No -- same recommendation: dedicated gallery delivery tool</td></tr>
<tr><td>Blog and SEO tooling</td><td>Strong SEO control; CMS for editorial blogs; schema requires code or third-party app</td><td>Blog with SEO sidebar, AI drafting, ImageObject + LocalBusiness + Article schema by default</td></tr>
<tr><td>Ecommerce for print sales</td><td>Yes -- Webflow Ecommerce ($29+/mo)</td><td>Limited -- not a primary ecommerce platform</td></tr>
<tr><td>Best fit</td><td>Design-literate photographers who want a custom portfolio with editorial CMS complexity</td><td>Photographers prioritizing search-driven content with minimal learning curve and lower cost</td></tr>
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
    question: "Is Webflow good for photographers?",
    answer:
      "Webflow is good for photographers who have design skills or work with a Webflow designer. Its ceiling for custom portfolio design is higher than any template-based builder -- pixel-perfect layouts, custom interactions, and a powerful CMS for managing large editorial catalogs. For photographers who are not designers and want to manage their own site without ongoing agency involvement, Webflow's learning curve and complexity make Squarespace, Wix, or BlogBat better defaults.",
  },
  {
    question: "Does Webflow have client proofing for photographers?",
    answer:
      "No. Webflow does not have native client gallery proofing or delivery tools. A photographer using Webflow still needs Pixieset, Pic-Time, CloudSpot, or ShootProof for client delivery, selection, and ordering. Webflow handles the public portfolio and marketing site; the delivery tools handle the client workflow. This is the same pattern as Squarespace -- Webflow is not a photography-specific platform.",
  },
  {
    question: "Should I use Webflow or BlogBat for my photography website?",
    answer:
      "Choose Webflow if you have design skills (or a Webflow designer), want a fully custom visual identity with complex interactions, and need a powerful CMS for managing a large editorial portfolio. Choose BlogBat if you want a free tier with a custom domain, no learning curve, AI-guided onboarding, a blog with SEO tooling and automated structured data (ImageObject, LocalBusiness, Article), and a lower monthly cost. BlogBat is better for photographers whose acquisition channel is local search and who want to manage their own site without design expertise.",
  },
  {
    question: "How steep is Webflow's learning curve for photographers?",
    answer:
      "Significant. Webflow's own community data and independent reviews consistently put the time to proficiency at 1-3 weeks for someone with design background. Concepts like div blocks, flexbox containers, CMS bindings, and interaction triggers are native Webflow vocabulary that must be learned before you can build and maintain the site. Photographers who are not visual designers typically either hire a Webflow specialist for the build and ongoing updates, or choose a simpler platform (Squarespace, Wix, or BlogBat) that doesn't require design vocabulary.",
  },
  {
    question: "How do photographers rank in local search with Webflow?",
    answer:
      "Webflow produces clean semantic code with full SEO control -- heading structure, title tags, meta descriptions, canonical URLs, and schema markup (which requires code or a third-party app to add on Webflow). For local search, photographers need: location + specialty pages targeting '[city] [session type] photographer'; a blog with location-specific content (venue guides, shoot recaps); LocalBusiness and ImageObject schema; and Google Business Profile optimization. BlogBat automates the structured data; Webflow requires it to be added via code embeds. Both can rank well; the difference is the per-page setup cost.",
  },
  {
    question: "What is Webflow's CMS, and does it help photographers?",
    answer:
      "Webflow's CMS is a structured content system rebuilt in 2025 into a significantly more powerful tool -- with reference fields, collection relationships, and granular editorial control. For photographers managing large, structured portfolio catalogs (commercial photographer with hundreds of campaigns, editorial photographer with publication references, studio with multiple photographers), Webflow's CMS is genuinely strong. For a solo photographer with a portfolio of 20-50 featured projects and a blog, the CMS adds capability that Squarespace or BlogBat's simpler content systems don't provide -- at the cost of complexity.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:webflow-for-photographers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:webflow-for-photographers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Webflow for photographers -- where it genuinely excels (custom design, CMS depth), where it demands too much (learning curve, complexity), and when BlogBat is the better default.",
        ctaText: "Start your photography website with BlogBat",
        ctaHref: "https://blogbat.com",
        verticalLabel: "For Photographers",
      },
      title: "Webflow for photographers: an honest alternative",
      metaDescription:
        "Is Webflow right for a photography website? An honest comparison covering design ceiling, learning curve, client proofing gaps, CMS complexity, and when BlogBat is the better default.",
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
    `[pilot:webflow-for-photographers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/webflow/for/photographers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:webflow-for-photographers] failed:", err);
    process.exit(1);
  });
