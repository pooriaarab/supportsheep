/**
 * Phase 1 pilot: seed `/alternatives/wix/for/photographers`.
 *
 * Doc id and `variantKey` are both `wix__photographers`.
 * Collection is `alternatives_for_vertical`. `publishStatus` is `noindex`.
 *
 * Idempotent -- re-running the script overwrites the doc via
 * `set({...}, { merge: true })`.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/write-alt-for-wix-photographers.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_ID = "wix__photographers";
const VARIANT_KEY = "wix__photographers";

const CONTENT = `## TL;DR

Wix is a strong contender for photographers who want a flexible, all-in-one platform: its Pro Gallery handles full-resolution image display, its client gallery tool (Wix Photo Albums) covers basic proofing without a third-party subscription, and its ecommerce engine handles digital and print sales. The tradeoffs are editor complexity (Wix's freedom can produce inconsistent layouts without design discipline), a SEO ceiling below WordPress for photographers building content-heavy brands, and a template library that is competitive but not as design-forward as Squarespace's for photographers specifically. This page covers both sides and explains where BlogBat fits for a photographer building a search-driven brand.

## Wix's genuine strengths for photographers

**Pro Gallery with full-resolution display.** Wix's Pro Gallery shows images at full resolution without compression artifacts. For a photographer who needs pixel-accurate image delivery -- commercial, fine art, architectural -- this is a meaningful feature. Squarespace automatically compresses uploads; Wix Pro Gallery does not.

**Client proofing through Wix Photo Albums.** Wix Photo Albums lets you create private client galleries where clients can view images, mark favorites (hearts), leave comments, and request downloads. This is not as polished as Pixieset or Pic-Time -- Wix Photo Albums lacks granular selection workflows, batch download permissions, and print ordering through the album -- but it eliminates the need for a third-party proofing subscription for photographers with basic proofing needs.

**Ecommerce for photo products.** Wix's ecommerce engine handles digital downloads (art prints, presets, educational materials) and physical print sales with integrations to fulfillment providers. A photographer building a product revenue stream alongside client work can do both from one platform.

**Booking tool for sessions.** Wix Bookings handles service listings and appointment scheduling. A portrait or family photographer who wants "book a session" directly on the site -- with service type, duration, price, and calendar availability -- can implement this natively. This is more integrated than embedding a Calendly link.

**200+ photography templates.** Wix has a large template library with photography-specific categories. While the design floor is lower than Squarespace's photography templates, the variety is wide -- from minimalist portfolio grids to full-bleed editorial designs.

**Editor flexibility.** Wix's drag-and-drop editor allows more arbitrary layout control than Squarespace or BlogBat. A photographer with a distinctive compositional sense who wants their website to reflect their artistic approach can implement non-standard layouts without CSS.

## Where Wix breaks down for photographers

**Editor complexity is real.** Wix's flexibility is also a liability for photographers who are not visual designers. The drag-and-drop freedom can produce inconsistent spacing, misaligned elements, and competing design choices that undermine the portfolio's credibility. Squarespace constrains you more; that constraint is protective for non-designers. BlogBat constrains you even more and bets on content over visual spectacle.

**Wix Photo Albums is not a full proofing tool.** Wix Photo Albums handles basic private gallery sharing and favoriting. It does not support: batch image selection with approval workflows, automated fulfillment ordering through a print lab, watermarking controls, download limits per image, or the polished client experience of Pixieset or Pic-Time. Photographers whose clients expect a professional gallery delivery experience will still pair Wix with a dedicated delivery tool.

**Template lock-in after launch.** Like Squarespace, Wix commits you to the template structure you picked at launch. Rebranding to a significantly different visual direction later requires a rebuild.

**SEO ceiling for content-heavy photography brands.** Wedding, portrait, and commercial photographers who invest heavily in content marketing -- venue guides, location-specific session recaps, educational posts, behind-the-scenes shoots -- eventually hit Wix's SEO ceiling. Schema automation (ImageObject, LocalBusiness, Article) is more manual on Wix than on a platform designed with content-first SEO. Programmatic local-SEO pages (one page per city + session type) require hand-building at any scale.

**Print lab fulfillment requires middleware.** Professional photographers typically order prints from labs like WHCC, Bay Photo, or Miller's. Wix Commerce integrates with some fulfillment providers but not the full professional lab ecosystem. Photographers who want seamless lab ordering typically add Pixieset Store or ShootProof as the commerce layer rather than relying on Wix's native fulfillment.

## The typical Wix photographer stack

Depending on the photographer's workflow:

- **Wix** -- public marketing site: portfolio display, about page, services and investment guide, blog, contact and booking.
- **Wix Photo Albums** -- for basic client previews if the photographer's proofing needs are simple.
- **Pixieset / Pic-Time / ShootProof** (optional) -- for photographers who need a polished proofing experience, print ordering, or lab fulfillment beyond Wix's native tools.
- **Honeybook / Dubsado** -- CRM for contracts, invoicing, questionnaires, and client communication.

Wix handles more of the workflow natively than Squarespace (native proofing, native booking, native commerce), though the native versions are less polished than their specialist alternatives.

## Wix vs Squarespace for photographers: an honest comparison

Both are strong defaults for photographers. The choice depends on priorities:

- **Squarespace wins on visual template quality.** Squarespace's photography-specific templates are more aesthetically polished out of the box -- full-bleed header treatments, elegant grid systems, cinematic hover effects. A photographer whose brand is design-forward benefits from Squarespace's higher design floor.
- **Wix wins on workflow integration.** Wix's native booking, basic proofing (Photo Albums), and ecommerce engine handle more of the photographer's workflow in one platform. A photographer who wants minimal vendor sprawl benefits from Wix's more integrated stack.
- **Both have similar SEO ceilings.** Neither Wix nor Squarespace automates the schema and programmatic SEO that a content-heavy photography brand eventually needs.

## BlogBat's position for a photographer building a search-driven brand

BlogBat is designed for "the solo service business that wants a credible content-led marketing site." For a photographer, that maps to:

- **A photographer whose primary acquisition channel is search, not social.** Wedding and portrait photographers who rank for "[city] wedding photographer" or "[venue] engagement session photos" are building a compounding SEO asset. BlogBat's blog with an SEO sidebar and AI drafting reduces the per-post friction of that content strategy.
- **Free tier with custom domain.** A photographer building a new brand can attach their domain to BlogBat before paying. Wix's free tier shows platform branding.
- **Structured data for photographers.** ImageObject schema on portfolio pages, LocalBusiness schema with service area, Article and FAQPage schema on relevant pages ship by default in BlogBat. Wix requires these to be added via a code block.
- **Honest about what it doesn't replace.** BlogBat is a marketing site builder, not a client gallery platform. A photographer using BlogBat still needs Pixieset or Pic-Time for client delivery, Honeybook or Dubsado for CRM, and a scheduling tool for bookings. The marketing site layer is where BlogBat competes.

## Side-by-side: Wix vs BlogBat for photographers

<table>
<thead>
<tr><th>Feature</th><th>Wix (Core / Business)</th><th>BlogBat</th></tr>
</thead>
<tbody>
<tr><td>Starting price (annual billing)</td><td>$29/mo (Core) -- $36/mo (Business)</td><td>Free tier with custom domain</td></tr>
<tr><td>Gallery display quality</td><td>Pro Gallery with full-resolution display (no compression)</td><td>Image-first layouts; standard compression and CDN delivery</td></tr>
<tr><td>Client proofing</td><td>Wix Photo Albums (basic -- favorites, comments, private galleries)</td><td>No native proofing -- use Pixieset, Pic-Time, or ShootProof</td></tr>
<tr><td>Session booking</td><td>Wix Bookings (native -- service types, duration, calendar)</td><td>Link to Calendly, Acuity, or Honeybook scheduler</td></tr>
<tr><td>Ecommerce for prints or digital downloads</td><td>Yes -- Wix Commerce with fulfillment integrations</td><td>Limited -- not a primary ecommerce platform</td></tr>
<tr><td>Blog and SEO tooling</td><td>Built-in blog; adequate basic SEO; schema requires manual code injection</td><td>Blog with SEO sidebar, AI drafting, ImageObject + LocalBusiness + Article schema by default</td></tr>
<tr><td>Best fit</td><td>Photographers who want native booking, basic proofing, and print sales in one platform</td><td>Photographers whose primary growth channel is search-driven content; want SEO machinery built in</td></tr>
</tbody>
</table>

## Five questions for a photographer deciding between Wix and BlogBat

1. **Do you need native booking on your website?** Wix Bookings is more integrated than a Calendly link. If a "Book a Session" button that opens availability on the site is important, Wix wins.
2. **Do you sell prints or digital products?** Wix Commerce handles this natively; BlogBat does not. If product sales are a meaningful revenue channel, Wix is the stronger platform.
3. **Is visual template design your top priority?** Squarespace wins here; Wix is second; BlogBat is last. If the visual portfolio experience is the deciding factor, Wix or Squarespace is the right call.
4. **Is search-driven content your primary client acquisition channel?** Photographers who rank for local keywords through consistent blogging benefit most from BlogBat's content-velocity tooling: SEO sidebar, AI drafting, automated structured data.
5. **What's your budget?** BlogBat's free tier with a custom domain is a different starting point than Wix Core at $29/month.`;

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
    question: "Is Wix good for photographers?",
    answer:
      "Yes, particularly for photographers who want an integrated platform with native booking (Wix Bookings), basic client proofing (Wix Photo Albums), and ecommerce for print or digital sales (Wix Commerce) -- all in one subscription. The tradeoffs are editor complexity (Wix's layout freedom can produce inconsistent results without design discipline), a template library that is not as design-forward as Squarespace's for photography specifically, and a SEO ceiling below WordPress for content-heavy brands. For a photographer whose primary acquisition channel is search, BlogBat's content machinery is a stronger default.",
  },
  {
    question: "Does Wix have client proofing for photographers?",
    answer:
      "Yes, through Wix Photo Albums -- but with limitations. Wix Photo Albums lets you create private client galleries where clients can view images, mark favorites, and leave comments. It does not support: professional selection workflows, batch download permissions, print ordering through a professional lab, or the polished client experience of Pixieset or Pic-Time. Photographers whose clients expect a dedicated gallery delivery experience typically still use a specialist tool (Pixieset, Pic-Time, ShootProof, CloudSpot) alongside Wix.",
  },
  {
    question: "Should I use Wix or BlogBat for my photography website?",
    answer:
      "Choose Wix if you want native booking (Wix Bookings), basic client proofing (Wix Photo Albums), and ecommerce for print or digital product sales in one platform -- and if layout flexibility matters for your brand expression. Choose BlogBat if your primary acquisition channel is search-driven content (blog posts, venue guides, session recaps, local SEO pages) and you want structured data (ImageObject, LocalBusiness, Article), an SEO sidebar, and AI-assisted blog drafting built in rather than added as an afterthought. BlogBat's free tier with a custom domain is also a different cost proposition than Wix Core at $29/month.",
  },
  {
    question: "Can I sell prints directly from a Wix photography website?",
    answer:
      "Yes. Wix Commerce handles digital downloads and physical print products. For professional print lab fulfillment (WHCC, Bay Photo, Miller's, Mpix Pro), most photographers add Pixieset Store, ShootProof, or a Zapier workflow to connect Wix orders to their preferred lab. Wix's native print fulfillment integrations cover a subset of the professional photography lab ecosystem; for seamless lab ordering, a specialist tool is typically added.",
  },
  {
    question: "How do photographers do local SEO for their website?",
    answer:
      "Local SEO for photographers centers on: (1) location + specialty pages targeting '[location] [session type] photographer' queries; (2) blog content -- venue guides, session recaps at specific locations, seasonal content that targets informational queries and builds topical authority; (3) Google Business Profile -- service area, specialty, client reviews; (4) ImageObject and LocalBusiness schema markup to signal the page's subject to search engines. BlogBat ships ImageObject, LocalBusiness, and Article schema by default; Wix requires code injection to add these.",
  },
  {
    question: "What is the difference between Wix and Squarespace for photographers?",
    answer:
      "Squarespace has a higher design floor for photography templates -- more visually polished out of the box, cinematic layouts, elegant grid systems. Wix offers more editor flexibility (drag-and-drop pixel control) and a more integrated workflow (native booking, basic proofing, ecommerce). Squarespace lacks native client proofing. Wix has native proofing but at a lower quality than specialist tools. Both have similar SEO ceilings for content-heavy photography brands, and both require a specialist client gallery tool (Pixieset, Pic-Time) for professional-grade delivery workflows.",
  },
];

async function main(): Promise<void> {
  const wordCount = countWords(CONTENT);
  if (wordCount < 1000) {
    throw new Error(
      `[pilot:wix-for-photographers] content is ${wordCount} words -- below the 1000-word cross-product floor`,
    );
  }
  if (wordCount > 1800) {
    throw new Error(
      `[pilot:wix-for-photographers] content is ${wordCount} words -- above the 1800-word cross-product ceiling`,
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
          "An honest look at Wix for photographers -- Pro Gallery display, native client proofing, ecommerce, and the editor complexity tradeoffs -- plus where BlogBat fits for search-driven photographers.",
        ctaText: "Start your photography website with BlogBat",
        ctaHref: "https://blogbat.com",
        verticalLabel: "For Photographers",
      },
      title: "Wix for photographers: an honest alternative",
      metaDescription:
        "Is Wix right for a photography website? An honest comparison covering Pro Gallery, client proofing via Wix Photo Albums, ecommerce, SEO ceiling, and when BlogBat is the better default.",
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
    `[pilot:wix-for-photographers] ${existing.exists ? "updated" : "created"} programmatic_pages/${DOC_ID}`,
  );
  console.info(
    JSON.stringify(
      {
        wordCount,
        faqCount: FAQS.length,
        publishStatus: "noindex",
        url: "/alternatives/wix/for/photographers",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pilot:wix-for-photographers] failed:", err);
    process.exit(1);
  });
