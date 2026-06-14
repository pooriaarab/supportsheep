/**
 * Phase 1 pilot: seed `/alternatives/squarespace/for/photographers`.
 *
 * Doc id and `variantKey` are both `squarespace__photographers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-squarespace-photographers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "squarespace__photographers";
const VARIANT_KEY = "squarespace__photographers";

const CONTENT = `## TL;DR

Squarespace is one of the most recommended website platforms for photographers, and the recommendation is mostly deserved. Its templates are genuinely excellent for image-first display, its gallery tools are solid, and it handles the hosting and domain plumbing without friction. The gaps emerge when a photographer's workflow extends beyond gallery display: native client proofing is absent (Squarespace has no feature comparable to Pixieset's proofing galleries), print fulfillment integrations are limited, and SEO beyond the basics requires workarounds. This page covers both sides honestly and explains where Supportsheep fits for a photographer-as-content-business.

## Where Squarespace genuinely excels for photographers

Be honest about the tool's real strengths before pointing at the limits:

**Visual templates tuned for photography.** Squarespace's template library is one of the best in the general-purpose-builder market, and its photography-specific templates are particularly strong. Full-bleed image headers, cinematic scroll effects, elegant grid galleries, masonry layouts -- these are native, well-implemented, and require zero custom CSS to look professional. For a photographer whose brand is the work itself, Squarespace's visual defaults are a genuine differentiator over generic builders.

**Gallery features that cover the basics.** Squarespace's built-in Gallery Blocks and Portfolio pages handle the standard display use cases: full-bleed slideshows, grid galleries, lightbox viewers, and basic folder-level organization. You can password-protect individual pages for client previews. Image auto-compression handles file-size optimization without manual intervention.

**Commerce for print sales.** Squarespace has a mature ecommerce engine. A photographer selling digital downloads or physical prints through a fulfillment service (WHCC, Bay Photo, Artifact Uprising via integration) can sell through the same site they show work on. This is a real advantage for photographers who sell direct-to-consumer.

**Integrated hosting and domain management.** The same one-bill, one-dashboard advantage applies here: no server administration, SSL handled, CDN included.

## Where Squarespace breaks down for professional photographers

**No native client proofing.** This is the most-cited limitation in photographer communities. Squarespace has no built-in client proofing tool comparable to Pixieset Galleries, Pic-Time, CloudSpot, or even SmugMug's client workflow. "Client proofing" means: client opens a private gallery, selects favorite images, leaves comments or favorites, and the photographer retrieves the selection. Squarespace does not have this. The workarounds are to password-protect a Gallery page (crude proofing -- client can view but can't mark favorites or comment) or to embed a third-party proofing tool (Pixieset, Pic-Time, ImageSilo) via an iframe. Most photographers who need real proofing use Pixieset for proofing and delivery and run a Squarespace marketing site alongside it.

**Template lock-in is acute for photographers.** Squarespace's template-lock policy (you cannot switch to a dramatically different template after launch without a rebuild) is especially painful in a visual-first context. A photographer who outgrows their initial design direction -- perhaps their brand evolves from wedding to commercial -- faces a full rebuild to change the visual system.

**Limited masonry and layout control in blog posts.** A recurring complaint in Squarespace forums: adding a masonry layout inside a blog post gallery is not natively supported and requires workarounds. Photographers who blog editorial work (behind-the-scenes posts, shoot recaps) find the inline gallery experience limiting.

**SEO customization is shallow for a content-heavy photographer.** Wedding and portrait photographers rank on "[[city] wedding photographer," "[location] engagement session," "[venue] portrait photographer." That requires: (1) well-structured location pages with ImageObject and LocalBusiness schema, (2) a blog with consistent metadata and internal linking, (3) potentially programmatic location × specialty pages at scale. Squarespace covers the basics but lacks the schema automation and programmatic-page tooling that a high-volume content strategy needs.

**Print fulfillment integration is limited.** Squarespace Commerce integrates natively with a handful of fulfillment providers, but the photography-specific print lab ecosystem (WHCC, Bay Photo, Miller's, Mpix Pro) typically requires a Zapier workflow or an intermediate tool like Pixieset Store or ShootProof for seamless lab fulfillment. It's doable, but it adds layers.

## The standard photographer stack with Squarespace

Most working photographers who use Squarespace run it as one component of a broader stack:

- **Squarespace** -- public marketing site: portfolio galleries, about page, services and investment guide, contact, blog.
- **Pixieset / Pic-Time / CloudSpot** -- client gallery delivery, proofing, downloads, and print ordering.
- **Honeybook / Dubsado / Studio Manager** -- CRM, contracts, invoicing, questionnaires, client communication.
- **Calendly or Acuity** -- initial consultation scheduling, linked from the Squarespace contact page.

If this stack sounds expensive: Pixieset's basic plan is free for limited storage and usage; Honeybook runs ~$36/month; Calendly has a free tier. It adds up, but the individual tools are best-in-class for their function, and none of them requires technical setup beyond pasting a link or embed code.

## Supportsheep's position for a photographer-as-content-business

Supportsheep is designed for the "supportsheep service business that needs a credible marketing site and wants to use content as a primary growth channel." A photographer who fits that description -- someone whose primary acquisition channel is search (Google finds, not social virality) -- is a reasonable Supportsheep user.

- **Free tier with custom domain.** A photographer building a new brand can launch on Supportsheep's free tier and attach their domain before committing to a paid plan. Squarespace requires a paid plan once the 14-day trial ends.
- **Blog with SEO sidebar and AI-assisted drafting.** For a wedding or portrait photographer building local-SEO authority ("Marin County family photographer," "Austin engagement session photographer"), consistent blog content -- shoot recaps, venue guides, client stories -- is the highest-leverage SEO tactic. Supportsheep's blog surfaces title/meta audits, internal link suggestions, and FAQPage JSON-LD inline. That's less tedious than remembering to check SEO after writing.
- **Structured data for photographers.** ImageObject schema on portfolio pages, LocalBusiness schema with service area, Article schema on blog posts, FAQPage schema on pages with Q&A content -- these ship by default in Supportsheep, without a plugin or custom code injection.
- **Supportsheep is honest about what it is not.** No native client gallery delivery, no proofing, no print fulfillment. The correct architecture for a photographer using Supportsheep is the same as the Squarespace photographer: marketing site on Supportsheep, client delivery on Pixieset/Pic-Time, CRM on Honeybook/Dubsado. Supportsheep is the marketing-and-content layer.

## Side-by-side: Squarespace vs Supportsheep for photographers

<table>
<thead>
<tr><th>Feature</th><th>Squarespace (Basic / Core / Plus)</th><th>Supportsheep</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$16/mo (Basic) -- $39/mo (Plus)</td><td>Free tier with custom domain</td></tr>
<tr><td>Photography templates</td><td>Best-in-class for visual polish; wide template library</td><td>Fewer templates; defaults optimized for content over visual spectacle</td></tr>
<tr><td>Built-in gallery and portfolio display</td><td>Strong -- Gallery Blocks, Portfolio pages, password-protected pages</td><td>Image-first layouts for portfolio display; less template variety than Squarespace</td></tr>
<tr><td>Native client proofing</td><td>No -- use Pixieset, Pic-Time, or CloudSpot alongside</td><td>No -- same recommendation: use a dedicated gallery delivery tool</td></tr>
<tr><td>Ecommerce for print sales</td><td>Yes -- Squarespace Commerce with print lab integrations</td><td>Limited -- not a primary ecommerce platform</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; basic SEO; limited schema automation</td><td>Blog with SEO sidebar, AI drafting, ImageObject + LocalBusiness + Article schema by default</td></tr>
<tr><td>Best fit</td><td>Design-led photographers who prioritize visual polish and sell prints or products through the site</td><td>Photographers whose primary growth channel is SEO and content; need less gallery spectacle, more content machinery</td></tr>
</tbody>
</table>

## Five questions to decide between Squarespace and Supportsheep as a photographer

1. **Is visual template variety your top priority?** If yes, Squarespace wins clearly -- its photography template library is best-in-class.
2. **Do you need ecommerce for print or product sales?** If yes, Squarespace's native commerce is better than Supportsheep's; plan your fulfillment stack.
3. **Is your primary acquisition channel search?** If yes, Supportsheep's content machinery (SEO sidebar, structured data, AI drafting) reduces the friction of content marketing.
4. **Are you building a content-heavy brand?** Photographers who publish shoot recaps, venue guides, and educational content benefit from a CMS that surfaces SEO signals inline. Supportsheep is designed for that use case.
5. **What's your budget at launch?** Supportsheep's free tier with a connected custom domain lets you test the marketing site before paying anything. Squarespace's trial ends after 14 days.`;

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
    question: "Is Squarespace good for photographers?",
    answer:
      "Yes, for most photography use cases. Squarespace's template library is one of the best in the general-purpose-builder market for image-first display, and its portfolio and gallery tools cover the standard display needs. The gaps are native client proofing (use Pixieset, Pic-Time, or CloudSpot alongside), template lock-in after launch, and shallow SEO customization for photographers building high-volume content strategies. For a photographer whose primary need is a beautiful portfolio with an integrated print shop, Squarespace is a strong default.",
  },
  {
    question: "Does Squarespace have client proofing for photographers?",
    answer:
      "No. Squarespace has no built-in client proofing tool -- no way for a client to open a private gallery, mark favorite images, or leave selection notes. The workarounds are password-protected Gallery pages (clients can view but can't mark favorites) or embedding a third-party proofing tool like Pixieset or Pic-Time via iframe. Most professional photographers who use Squarespace as their marketing site use a dedicated gallery delivery tool (Pixieset, Pic-Time, CloudSpot, ShootProof) for the client proofing and delivery workflow.",
  },
  {
    question: "Should I use Squarespace or Supportsheep for my photography website?",
    answer:
      "Choose Squarespace if visual polish and print ecommerce are your priorities -- its photography templates are best-in-class and its commerce engine handles direct print sales. Choose Supportsheep if your primary growth channel is search-driven content (blog posts, venue guides, shoot recaps, FAQ content) and you want SEO tooling (sidebar audits, AI drafting, structured data) built into the CMS rather than added as an afterthought. Both platforms require the same supplemental stack for photographers: a dedicated client gallery tool (Pixieset/Pic-Time), a CRM (Honeybook/Dubsado), and a scheduling tool (Calendly/Acuity).",
  },
  {
    question: "What client gallery tools work with Squarespace?",
    answer:
      "Pixieset is the most popular choice -- it has a free tier and a polished client gallery experience. Pic-Time, CloudSpot, ShootProof, and ImageSilo are strong alternatives with varying price points and features. These tools handle client delivery, proofing (favorites, selections, comments), downloads, and print ordering. They integrate with Squarespace by embedding an iframe or linking from the Squarespace contact confirmation or booking page.",
  },
  {
    question: "How do photographers do local SEO for their photography website?",
    answer:
      "Local SEO for photographers centers on three tactics: (1) location + specialty pages -- a dedicated page for each city, venue, or session type you photograph, each targeting a '[location] [session type] photographer' keyword cluster; (2) blog content -- shoot recaps at specific venues, location guides, seasonal content; these compound into local search authority over 12-18 months; (3) Google Business Profile -- claim it, add your service area, collect client reviews. Supportsheep's blog ships with Article schema, FAQPage schema, and LocalBusiness schema by default, which reduces the friction of executing this content strategy.",
  },
  {
    question: "Can I sell prints through my Squarespace photography website?",
    answer:
      "Yes. Squarespace Commerce lets you set up a shop for digital downloads or physical prints. For professional-grade lab fulfillment, most photographers use an integration or middleware tool (WHCC, Bay Photo, Mpix Pro) connected via Pixieset Store, ShootProof, or Zapier. Squarespace's native ecommerce handles the storefront and checkout; the fulfillment lab handles production and shipping. Supportsheep is not a primary ecommerce platform -- if selling prints is a significant revenue channel, Squarespace's ecommerce is a meaningful differentiator.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:squarespace-for-photographers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:squarespace-for-photographers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Squarespace for professional photographers -- where it genuinely excels (templates, gallery display, print ecommerce) and where it falls short (client proofing, SEO depth) -- plus where Supportsheep fits.",
        ctaText: "Start your photography website with Supportsheep",
        ctaHref: "https://supportsheep.com",
        verticalLabel: "For Photographers",
      },
      title: "Squarespace for photographers: an honest alternative",
      metaDescription:
        "Is Squarespace right for a photographer? An honest comparison covering gallery tools, client proofing gaps, print sales, SEO limits, and when Supportsheep is the better default.",
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
    `[pilot:squarespace-for-photographers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/squarespace/for/photographers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:squarespace-for-photographers] failed:", err);
    process.exit(1);
  });
