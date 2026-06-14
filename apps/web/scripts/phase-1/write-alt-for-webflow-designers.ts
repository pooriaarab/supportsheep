/**
 * Phase 1 pilot: seed `/alternatives/webflow/for/designers`.
 *
 * Doc id and `variantKey` are both `webflow__designers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-webflow-designers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "webflow__designers";
const VARIANT_KEY = "webflow__designers";

const CONTENT = `## TL;DR

Webflow is widely regarded as the strongest general-purpose website platform for designers and creative agencies. Its visual development environment generates clean, semantic code as you design; its CMS (rebuilt significantly in 2025) handles structured content with depth that template builders cannot match; and its SEO control is granular enough for competitive keyword strategies. For a freelance designer or small design studio that wants to showcase work, attract clients, and potentially manage client sites in an agency model, Webflow is the most honest recommendation in the builder category. The question is not whether Webflow is right for designers in general -- it is whether it is right for *your* design practice at its current scale. This page covers both sides and addresses where BlogBat is the relevant alternative.

## Why Webflow has become the standard portfolio platform for designers

Webflow's appeal to designers is structural, not superficial:

**Code fidelity.** Webflow generates real HTML, CSS, and JavaScript -- not proprietary markup layered over a CMS. A designer who understands web fundamentals can predict exactly what Webflow will produce. The browser interprets Webflow output as native code. This matters for performance, accessibility, and SEO in ways that template builders cannot replicate.

**Visual design without constraints.** Unlike Squarespace (constrained column grid) or Wix (constrained to sections), Webflow's canvas allows positioning, sizing, and responsive behavior to be defined at the element level. For a designer who thinks in terms of layout systems, type hierarchies, and motion -- not "which template blocks do I want" -- Webflow removes the ceiling.

**Interactions and animations.** Webflow's interaction system allows scroll-triggered animations, hover effects, parallax sequences, and page transitions to be defined visually without writing JavaScript. For a design portfolio where the site itself is a demonstration of craft, this is a meaningful differentiator.

**CMS for case study management.** A designer who publishes case studies -- project summaries, client work, process documentation -- benefits from Webflow's CMS collections. Case studies can be structured with fields for client name, industry, deliverables, tools used, and publication date; the template handles layout consistently. The CMS rebuilt in 2025 added reference fields and collection relationships, making it one of the most capable no-code CMS tools available.

**Portability.** Webflow exports clean code. A designer who later wants to host independently, or deliver a Webflow-built site to a client who uses a different host, has that option. This is not available in Squarespace, Wix, or GoDaddy.

## Where Webflow demands more than it returns for some designers

**The learning curve is real -- and permanent.** Webflow's community consistently reports 1-3 weeks to become proficient for someone with design experience. More importantly, maintaining a Webflow site requires ongoing design vocabulary: div blocks, flexbox, grid containers, CMS bindings, interaction triggers. A freelance designer who builds their own site and then doesn't touch Webflow for six months will lose fluency. For designers who use Webflow regularly in client work, this is a non-issue; for those who just need a personal portfolio, the maintenance cost is higher than expected.

**Cost scales with features.** Webflow's free plan does not allow publishing on a custom domain. A custom-domain site starts at $14/month (basic, no CMS). A designer who uses the CMS for case studies and a blog typically needs the CMS plan ($23/month). Agency and team features add more. For a freelance designer building their first portfolio, this is manageable; for a student or early-career designer price-sensitive about overhead, the cost of entry is higher than Squarespace, Wix, or BlogBat.

**Not every designer needs Webflow's ceiling.** Some designers need a portfolio that looks good, loads fast, and ranks in local or topical search -- and their time is better spent on client work than on mastering Webflow. For those designers, a simpler platform (Squarespace for design polish, BlogBat for content velocity and local SEO) is a legitimate choice.

**Enterprise features require enterprise plans.** Webflow's Enterprise plan is used by larger design agencies and in-house teams with client management, multi-user collaboration, and white-labeling needs. For a freelance designer or small studio, the relevant comparison is the self-serve plans -- which are capable but priced to require judgment about whether the feature depth is necessary.

## What the designer's website actually needs to do

Most freelance designer portfolios need to accomplish three things:

1. **Show the work.** Case studies with context: the brief, the solution, the outcome. Not just screenshots.
2. **Signal expertise and filter clients.** The writing, the visual choices, and the framing of past work together signal what kind of clients the designer works with and what they charge. This is the portfolio's primary conversion mechanism.
3. **Rank for relevant search.** Freelance designers with active inbound pipelines often rank for "[design specialty] [city]," "[design specialty] freelancer," or "[design specialty] for [industry]." Local and topical SEO matters more for conversion than social proof alone.

Webflow excels at 1 and 2. For 3, Webflow is strong on SEO control but requires more configuration (schema, structured metadata, blog) to fully activate.

## BlogBat's position for designers who prioritize content and local search

BlogBat is not a Webflow alternative for designers who need design precision. The product comparison in the competitor positioning guide is direct: "Webflow is a pro-grade visual CMS requiring design skill. BlogBat is not a Webflow alternative; it is an alternative to 'I'll just get it done.'"

That said, BlogBat is relevant for designers who:

- **Are in an early-career phase.** A designer building their first portfolio while still in school or early in a career does not need Webflow's complexity. A functional, content-rich site on BlogBat costs less and requires less maintenance.
- **Prioritize content marketing over design spectacle.** A designer who writes about their process, their specialty, or their industry (UX for healthcare, brand identity for startups, motion design for tech companies) accumulates topical authority through content. BlogBat's blog with an SEO sidebar, AI drafting, and automated structured data is designed for this content-velocity use case.
- **Want a project site or content site alongside their main portfolio.** Some designers maintain a separate content site (a newsletter, a process blog, a resource site) that is not the design portfolio. BlogBat is appropriate for that secondary site.
- **Free tier allows experimentation.** BlogBat's free tier with a custom domain lets a designer test the platform before paying anything. Webflow's free plan does not publish on a custom domain.

## Webflow vs Squarespace vs BlogBat for designers: honest positioning

<table>
<thead>
<tr><th>Factor</th><th>Webflow</th><th>Squarespace</th><th>BlogBat</th></tr>
</thead>
<tbody>
<tr><td>Design ceiling</td><td>Highest -- pixel-perfect custom, full interaction control</td><td>High -- polished templates, constrained to template grid</td><td>Lower -- AI-guided layouts, content-first</td></tr>
<tr><td>Learning curve</td><td>Steep (1-3 weeks for experienced designers)</td><td>Low-moderate</td><td>Low</td></tr>
<tr><td>Starting price</td><td>$14/mo (basic) -- $23/mo (CMS); free plan does not publish on custom domain</td><td>$16/mo (annual)</td><td>Free tier with custom domain</td></tr>
<tr><td>CMS for case studies</td><td>Strongest -- structured collections, reference fields, batch management</td><td>Portfolio blocks -- less structured, no reference fields</td><td>Blog-based -- adequate for a content site, not an agency CMS</td></tr>
<tr><td>SEO control</td><td>Most granular -- full heading control, schema via code, clean code output</td><td>Good basics; schema requires code injection</td><td>Good basics; schema ships automatically (LocalBusiness, Article, FAQPage)</td></tr>
<tr><td>Code portability</td><td>Yes -- clean HTML/CSS export</td><td>No</td><td>No</td></tr>
<tr><td>Best fit for designers</td><td>Design-literate freelancers and studios who use Webflow in client work; want the portfolio to demonstrate craft</td><td>Designers who want a polished template-based portfolio without Webflow's complexity</td><td>Early-career designers; content-focused practitioners; secondary content sites alongside a main portfolio</td></tr>
</tbody>
</table>

## A designer's checklist for evaluating Webflow vs simpler alternatives

1. **Do you use Webflow in client work?** If yes, the portfolio is also a proof of competency, and Webflow is the obvious choice. If not, the ongoing maintenance cost is higher.
2. **How many case studies do you have, and how structured are they?** Webflow's CMS shines for 10+ case studies with consistent structure. For 3-5 case studies, Squarespace's portfolio blocks or a simple BlogBat page work fine.
3. **Is design precision a differentiator for your client acquisition?** If potential clients evaluate your site as evidence of your design thinking, Webflow's ceiling matters. If they evaluate your writing, process, and testimonials, a simpler platform works.
4. **What's your maintenance budget?** Webflow requires ongoing design vocabulary to update. Factor in your time or a retainer for a Webflow developer when comparing costs.
5. **Are you building for search?** If local or topical SEO is part of your acquisition strategy, evaluate the schema and blog tooling of each platform. BlogBat automates schema; Webflow requires code; Squarespace requires code injection for structured data.`;

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
    question: "Is Webflow good for designers?",
    answer:
      "Yes, Webflow is widely regarded as the strongest general-purpose platform for designers and creative agencies. It generates clean, semantic code from visual design; has a powerful CMS for structured case study management; allows precise interaction and animation design without JavaScript; and produces SEO-ready output. The caveats are a real learning curve (1-3 weeks for designers with web experience) and ongoing maintenance that requires design vocabulary. For designers who use Webflow in client work and want the portfolio to demonstrate craft, Webflow is the honest recommendation.",
  },
  {
    question: "Should a freelance designer use Webflow or Squarespace?",
    answer:
      "Choose Webflow if you use it in client work, need a CMS for 10+ structured case studies, want custom interactions that showcase your motion and interaction design, and are comfortable with its learning curve. Choose Squarespace if you want a polished portfolio without the design vocabulary investment -- Squarespace's templates are best-in-class, the editor is approachable, and the result is professional without requiring you to master flexbox and CMS bindings. Webflow's ceiling is higher; Squarespace's floor is more reliable for non-Webflow practitioners.",
  },
  {
    question: "Should I use Webflow or BlogBat for a design portfolio?",
    answer:
      "BlogBat is not a Webflow alternative for designers who need design precision. Choose Webflow if design craft is the point of the portfolio. Choose BlogBat if you are early-career and want a lower-cost, lower-maintenance content site; if your acquisition channel is content marketing and local/topical search more than visual portfolio showcase; or if you want to build a secondary content or blog site alongside your main portfolio. BlogBat's free tier with a custom domain, automated structured data, and SEO blog tooling is designed for the content-velocity use case, not the design-precision use case.",
  },
  {
    question: "What is Webflow's CMS, and why does it matter for a designer's portfolio?",
    answer:
      "Webflow's CMS is a structured content system rebuilt in 2025 with reference fields, collection relationships, and granular content control. For a designer, it means: case studies can be managed as structured database entries with consistent fields (client, industry, deliverables, tools, date); the template handles layout automatically; batch editing and filtering work across the collection; and the system scales to 10, 50, or 100+ case studies without manual layout work. This is a meaningful advantage over Squarespace's portfolio blocks (less structured) or a blog-based approach (no relational fields).",
  },
  {
    question: "How does Webflow's SEO compare to other platforms for designers?",
    answer:
      "Webflow gives more granular SEO control than template builders: full heading hierarchy without CSS workarounds, clean semantic code that search engines parse accurately, fine-grained meta control per CMS item, and schema markup that can be added via Webflow's code embed blocks. For a designer targeting '[specialty] designer [city]' or '[specialty] freelancer' queries, Webflow's SEO ceiling is higher. BlogBat automates schema markup (Article, LocalBusiness, FAQPage) by default, reducing per-page setup cost at the expense of less customization; Webflow requires schema to be added manually but provides more control over what's emitted.",
  },
  {
    question: "Can designers sell services or products through Webflow?",
    answer:
      "Webflow has an ecommerce module starting at $29/month that handles digital and physical product sales. For designers selling templates, assets, presets, courses, or design resources, Webflow Ecommerce is a capable option. It handles product pages, checkout, payments (Stripe, PayPal), and order management. The trade-off is higher plan cost and more setup than a dedicated product-sales platform (Gumroad, Lemon Squeezy). For a designer whose primary revenue is services (not products), ecommerce is likely unnecessary.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:webflow-for-designers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:webflow-for-designers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Webflow for freelance designers and creative studios -- covering design ceiling, CMS depth, learning curve, and when BlogBat is the relevant alternative for content-driven practices.",
        ctaText: "Start your design portfolio with BlogBat",
        ctaHref: "https://blogbat.com",
        verticalLabel: "For Designers",
      },
      title: "Webflow for designers: an honest alternative",
      metaDescription:
        "Is Webflow right for a designer's portfolio? An honest comparison covering design ceiling, CMS for case studies, learning curve, and when BlogBat is the better default for content-first designers.",
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
    `[pilot:webflow-for-designers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/webflow/for/designers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:webflow-for-designers] failed:", err);
    process.exit(1);
  });
