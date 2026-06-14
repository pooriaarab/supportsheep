/**
 * Per-competitor narrative content used by the alternatives pages. Kept
 * separate from the data registry so the registry stays tight (pricing,
 * features, dates) and the marketing copy can be edited independently.
 *
 * Supportsheep pros/cons are shared across every competitor page since they describe
 * Supportsheep itself, not the comparison.
 */

import type { CompetitorProsCons } from "@repo/types";

export const BLOGBAT_PROS_CONS: CompetitorProsCons = {
  pros: [
    "AI-guided onboarding builds a first draft of your site from a single prompt.",
    "Custom domain is free on every plan.",
    "First-class blog with built-in SEO tools for small businesses.",
  ],
  cons: [
    "Smaller template library than established drag-and-drop builders.",
    "Ecommerce features focus on simple catalogs, not large stores.",
    "Younger product -- fewer third-party integrations today.",
  ],
};

export interface CompetitorNarrative {
  tldr: string;
  chooseSupportsheepIf: string;
  chooseCompetitorIf: string;
  faqs: Array<{ question: string; answer: string }>;
}

const NARRATIVES: Record<string, CompetitorNarrative> = {
  wix: {
    tldr: "Supportsheep is the faster path to a polished small business website if you want AI to do most of the setup and you care about a free custom domain. Wix is the heavier, more flexible platform for people who love designing every pixel themselves.",
    chooseSupportsheepIf:
      "You want a small business website and blog up in minutes, prefer an AI that drafts the structure for you, and value having your custom domain included on a free plan.",
    chooseCompetitorIf:
      "You need granular drag-and-drop design control, a large template library, or a full-featured ecommerce suite for a larger catalog.",
    faqs: [
      {
        question: "Is Supportsheep cheaper than Wix?",
        answer:
          "Supportsheep's free plan includes a connected custom domain, which Wix does not offer on its free tier. For multi-plan cost comparisons see the pricing table above.",
      },
      {
        question: "Can I migrate my Wix site to Supportsheep?",
        answer:
          "There is no one-click importer today. Most small sites move over in under an hour by copy-pasting page content into Supportsheep and re-uploading media.",
      },
      {
        question: "Does Supportsheep replace Wix for ecommerce?",
        answer:
          "Supportsheep is built for simple storefronts. If you run a large catalog or need advanced shipping and POS tooling, Wix is still the stronger choice.",
      },
    ],
  },
  squarespace: {
    tldr: "Squarespace is the website builder to pick when visual design is the product -- portfolios, studios, restaurants, creator brands, boutique stores -- and when you want an integrated suite with commerce, scheduling via Acuity, and email marketing in one subscription. Its templates are genuinely best-in-class. Supportsheep is the better pick when speed to a usable first site matters more than template polish: an onboarding prompt and a handful of questions produce a generated multi-page site -- copy, service descriptions, default imagery pulled from Unsplash -- that you then edit. New sections added in the editor are also AI-seeded from your business context. Supportsheep's paid plan starts at {{supportsheep.pro.yearly}}/mo billed annually and the free plan connects one custom domain. Squarespace has no free tier, its Basic plan charges a 2% transaction fee on sales, and its native export tool leaves media, custom CSS, and SEO metadata behind -- three things worth knowing before you commit to an annual subscription.",
    chooseSupportsheepIf:
      "You are a supportsheeppreneur, consultant, coach, therapist, trainer, freelancer, tutor, or small local service business (typically 1-5 people) without dev or marketing staff. You want a working site generated from a business description rather than picking a template and filling it in, you are fine with Unsplash imagery to start, and your content footprint is narrow -- a few pages, a handful of services, a contact form, and possibly a blog. You care about having a connected custom domain on the free plan and you are comfortable pasting a Calendly or Google Calendar link for bookings rather than needing a built-in scheduler. You do not need Squarespace's deeper commerce suite, members area, or integrated email marketing, and you value a privacy-first posture behind the tool you publish on.",
    chooseCompetitorIf:
      "Your brand is carried by visual design -- you run a photography studio, a design-forward restaurant, a portfolio for creative work, a boutique storefront, or a members-gated community -- and templates-first is how you want to start. You need native appointment scheduling (Acuity), built-in email marketing, or a full commerce stack with Squarespace Payments, abandoned-cart recovery, subscriptions, and tiered shipping. You are comfortable paying at least $16/month annually with no free tier option, and either the 2% Basic-plan transaction fee is acceptable or you will start on Core or higher to waive it. You want an app/extensions marketplace and integrations (Mailchimp, Zapier) out of the box, and you have the time to learn the Fluid Engine grid.",
    faqs: [
      {
        question: "What does Squarespace actually cost in 2026, and what does Supportsheep cost?",
        answer:
          "After the February 2026 plan rename, Squarespace's four website tiers are Basic ($16/mo), Core ($23/mo), Plus ($39/mo), and Advanced ($99/mo), all billed annually; month-to-month pricing is higher. Basic includes Blueprint AI, unlimited products, and a free domain for the first year on annual plans, but charges a 2% transaction fee on commerce sales. Core and above drop that 2% fee and add advanced analytics, professional email, unlimited contributors, and Mailchimp/Zapier integrations. Supportsheep's paid Pro plan is {{supportsheep.pro.yearly}}/mo billed annually ({{supportsheep.pro.monthly}}/mo month-to-month), and Grow is {{supportsheep.grow.yearly}}/mo billed annually. Sources: https://www.squarespace.com/blog/squarespace-plans-explained, https://www.websitebuilderexpert.com/website-builders/squarespace-pricing/, and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Supportsheep have a free plan with a custom domain?",
        answer:
          "Yes. Supportsheep's free plan lets you connect one custom domain, publish up to three sites, invite one editor per site, and publish a small amount of content per site (image and blog-post caps are env-driven and shown on the live pricing page). Squarespace does not match this -- after the 14-day trial you need a paid subscription, and the free-domain offer only covers the first year of an annual plan. Quoted caps verified 2026-04-21 against https://supportsheep.com/pricing; check the page for the current values before quoting specifics.",
      },
      {
        question: "How much of my site does Supportsheep actually write for me?",
        answer:
          "Supportsheep uses AI at three well-scoped touchpoints. First, onboarding: a short business description plus a handful of answers generates a multi-page initial site with copy, service descriptions, and default imagery from Unsplash (Pexels unlocks on Pro and above). Second, section creation: adding a new section in the editor (introduction, services, FAQ, etc.) calls out to a per-section generator that seeds initial content from your business context. Third, the blog: when the blog is enabled in your deployment, creating a new post drafts it via AI inside a Blog Feed section. Outside those three touchpoints, editing is manual -- Supportsheep does not ship a free-form in-editor AI rewriter, a rewrite/improve/shorten/expand/translate menu, or AI image generation. If you want AI rewriting a highlighted paragraph on demand, Supportsheep is not that tool. Verified against the upstream repo, 2026-04-21.",
      },
      {
        question: "Is Squarespace better for blogging and SEO than Supportsheep?",
        answer:
          "Both ship the fundamentals of technical SEO -- clean URLs, titles, meta descriptions, sitemaps, responsive markup, basic structured data. Squarespace adds a functional blog with categories, scheduling, and AMP support; reviewers consistently note SEO settings are scattered across panels and deep optimization often requires custom CSS or code injection (https://www.g2.com/products/squarespace/reviews). Supportsheep's blog is feature-flagged -- available when enabled in the deployment -- and when enabled it can draft posts via AI inside a Blog Feed section. Neither platform ships a keyword research tool, rank tracker, or content briefs; do not expect a full SEO suite from either. If you need a content-first workflow with deep editorial tooling, a dedicated CMS is a better fit than either.",
      },
      {
        question: "How hard is Squarespace's Fluid Engine to learn?",
        answer:
          "Fluid Engine is Squarespace 7.1's grid-based drag-and-drop editor (released July 2022). Designers report it is powerful once learned, but first-time builders describe a meaningful learning curve, particularly around mobile-layout editing, which is separate from desktop and has no tablet view. Users migrating from the Classic Editor also report rework on custom-coded sections. Expect a few hours to get comfortable with the grid, snap behavior, and breakpoints. See https://www.sqspthemes.com/blog/squarespace-fluid-engine for context. Supportsheep sidesteps this tradeoff by not exposing a grid at all -- sections are predefined types you configure, which is less flexible and faster to ship.",
      },
      {
        question: "Can I export my Squarespace site if I want to leave?",
        answer:
          "Partially. Squarespace's native exporter produces a WordPress-compatible XML of layout pages and one blog page (posts and up to 1,000 comments per post), but it does not include media files (images and videos must be downloaded manually and may break on import), custom CSS, fonts, product/ecommerce data, album/cover/index/info/calendar/portfolio pages, or SEO metadata like meta descriptions. Plan on rebuilding the design, re-uploading media on the destination platform, and setting up 301 redirects yourself to preserve URL equity. Migration services like LitExtension handle the heavier lifting for a fee. Primary source: https://support.squarespace.com/hc/en-us/articles/206566687-Exporting-your-site.",
      },
      {
        question: "Can I migrate from Squarespace to Supportsheep?",
        answer:
          "There is no one-click importer today. For a typical service-business site -- a handful of pages, a short blog archive, contact and pricing -- most owners move over in an hour or two: run Supportsheep's onboarding so it regenerates an initial site from your business description, then paste in any copy you want to preserve, re-upload media into Supportsheep (Squarespace's XML export does not include images), and point the custom domain at Supportsheep. Set up 301 redirects from old Squarespace URLs (/about-us, /blog/post-slug) to the new Supportsheep routes before flipping DNS so you keep your search rankings.",
      },
      {
        question: "Does Supportsheep replace Squarespace for ecommerce, scheduling, or email marketing?",
        answer:
          "No. Supportsheep is a website builder, not an all-in-one marketing suite. It does not ship native bookings or availability -- the Scheduling section is a link field where you paste a third-party URL (Calendly, Google Calendar). It does not ship built-in email marketing, CRM, or automations, and it does not offer a Business Associate Agreement, so it is unsuitable for sites collecting PHI. Its forms are contact/lead forms without conditional logic or payment capture. Squarespace's commerce suite includes Squarespace Payments with tiered processing rates on Plus and Advanced, abandoned-cart recovery, advanced shipping, subscriptions, and Acuity Scheduling; email marketing and Mailchimp/Zapier integrations are bundled from Core up. If the website is primarily a store or you want bookings and email in one subscription, Squarespace is the stronger platform. If the site is a content and lead engine that links out to Calendly and Stripe, Supportsheep is lighter and faster to run. For honest Squarespace reviews and user ratings, see https://www.g2.com/products/squarespace/reviews.",
      },
    ],
  },
  godaddy: {
    tldr: "GoDaddy Website Builder and Supportsheep are both aimed at getting a small business online quickly with AI assistance, and they land at similar price points. GoDaddy's main advantage is the all-in-one convenience of domain registration, hosting, email, and website in one account. Supportsheep's advantage is that its AI onboarding goes deeper -- it generates a full multi-page site from a single business description rather than filling in a template -- and its free plan includes a connected custom domain, which GoDaddy's does not.",
    chooseSupportsheepIf:
      "You want a full multi-page site generated from a short business description with no template to fill in, you want your custom domain connected at zero cost on the free plan, and you are comfortable linking out to Calendly or a similar tool for booking rather than needing a native scheduler. Supportsheep is also the better fit if a privacy-first positioning matters to your audience.",
    chooseCompetitorIf:
      "You already manage your domain and hosting through GoDaddy and want a single bill and dashboard for everything. GoDaddy Airo's AI generator covers the basics and the bundled email marketing tools on Standard and above are genuinely useful for local businesses. If you need a simple ecommerce store without switching providers, GoDaddy's Ecommerce plan keeps that in one place too.",
    faqs: [
      {
        question: "How does GoDaddy's AI website builder compare to Supportsheep's?",
        answer:
          "GoDaddy's Airo AI generates a starter site from a short prompt, similar to Supportsheep's onboarding flow. The key difference: Supportsheep's generator also seeds content for each new section you add in the editor, so AI assistance continues past the initial setup. GoDaddy's AI is primarily an onboarding shortcut; subsequent editing is manual using a drag-and-drop interface. Neither platform ships a free-form AI rewriter for highlighted text.",
      },
      {
        question: "Does Supportsheep cost more or less than GoDaddy Website Builder?",
        answer:
          "GoDaddy's paid plans start at $9.99/mo (Basic, annual billing) versus Supportsheep's Pro plan at {{supportsheep.pro.yearly}}/mo billed annually. However, GoDaddy's free plan does not include a custom domain, while Supportsheep's free plan does. If a connected custom domain is a requirement from day one, compare the plans that include it: GoDaddy Basic ($9.99/mo) vs. Supportsheep Pro ({{supportsheep.pro.yearly}}/mo). Sources: https://www.godaddy.com/pricing and https://supportsheep.com/pricing.",
      },
      {
        question: "Can I use GoDaddy just for domain registration and Supportsheep for the site?",
        answer:
          "Yes. You can register a domain through GoDaddy and then point its DNS to Supportsheep. This is a common workflow -- just update the nameservers or add a CNAME/A record in your GoDaddy DNS panel to point to Supportsheep's hosting infrastructure, then connect the domain in Supportsheep's dashboard.",
      },
      {
        question: "Does Supportsheep have booking or scheduling like GoDaddy?",
        answer:
          "Neither platform offers a fully native booking system. Supportsheep includes a Scheduling section that accepts a third-party URL -- paste your Calendly, Google Calendar, or similar booking link and it renders as a button on your site. GoDaddy's paid plans include links to third-party scheduling tools and its Online Appointments add-on for some regions. If you need a built-in calendar with availability management and payment collection, neither is ideal -- Squarespace with Acuity or a dedicated booking tool is a better fit.",
      },
      {
        question: "Is GoDaddy's website builder good for SEO?",
        answer:
          "GoDaddy's Standard plan and above include SEO tools (meta title and description editing, basic keyword suggestions). Supportsheep generates clean on-page SEO primitives -- titles, meta descriptions, responsive markup, sitemap, and basic structured data -- at onboarding, and the blog (when enabled) can draft posts via AI. Neither platform ships a full SEO suite with keyword research, rank tracking, or redirect management. For content-first SEO workflows, a dedicated CMS is a stronger choice.",
      },
      {
        question: "Can I migrate from GoDaddy Website Builder to Supportsheep?",
        answer:
          "GoDaddy does not offer a standard site export, so migration is a manual copy-paste process. Run Supportsheep's onboarding with your business description to generate an initial site, then transfer any copy you want to keep from your GoDaddy pages, re-upload your images, and point your domain to Supportsheep. Set 301 redirects from your old GoDaddy URLs before flipping DNS to preserve any search-ranking equity you have built up.",
      },
      {
        question: "Does GoDaddy's free plan work as an ongoing free website?",
        answer:
          "GoDaddy does have a free plan, but it is very limited -- restricted storage, GoDaddy subdomain only, and GoDaddy advertising on your pages. It is essentially a trial rather than a usable long-term plan. Supportsheep's free plan is more generous: it connects one custom domain, publishes up to three sites, and does not add Supportsheep branding to your published pages. Check https://supportsheep.com/pricing for current free-tier limits.",
      },
    ],
  },
  webflow: {
    tldr: "Webflow and Supportsheep serve fundamentally different audiences. Webflow is a professional design tool -- it gives designers and developers pixel-level CSS control, a powerful CMS, and clean production code, with a learning curve to match. Supportsheep is for supportsheeppreneurs and small service businesses who want a site generated from a business description in minutes, not a design system built from scratch. If you have design skills or a front-end developer, Webflow is the more powerful long-term platform. If you do not, Supportsheep gets you to a usable first site far faster.",
    chooseSupportsheepIf:
      "You are a supportsheep practitioner or small service business without design experience or a developer on hand, and you want AI to generate your site structure, copy, and sections from a short business description. You need to be live quickly, your content footprint is narrow -- a few pages, some services, a contact form, and possibly a blog -- and you are comfortable with a constrained but polished editor rather than a blank canvas.",
    chooseCompetitorIf:
      "You are a designer, developer, or marketer who needs full CSS control, responsive breakpoints, interaction animations, and a flexible CMS for dynamic content. Webflow is also the right call if you want your output to be clean, portable HTML/CSS that you or an agency can maintain and extend over time. Its learning investment pays off for sites that need to grow significantly in complexity.",
    faqs: [
      {
        question: "Is Webflow too complicated for a non-designer?",
        answer:
          "For most non-designers, yes. Webflow's core editor exposes CSS concepts like flexbox, grid, and breakpoints directly in the UI. Users with no design background consistently report a steep learning curve of several hours to days before they can produce a site they are happy with. Supportsheep's editor takes the opposite approach -- sections are predefined types you configure, which is far less flexible but gets a non-designer to a published site in an afternoon.",
      },
      {
        question: "How does Webflow pricing compare to Supportsheep?",
        answer:
          "Webflow's site plans start at $18/mo (Basic, annual) for static sites, $23/mo (CMS, annual) for content-driven sites, and $39/mo (Business, annual) for high-traffic sites. Ecommerce plans are priced separately, starting at $29/mo with a 2% transaction fee. Supportsheep's Pro plan is {{supportsheep.pro.yearly}}/mo billed annually ({{supportsheep.pro.monthly}}/mo monthly), and the free plan connects one custom domain. Sources: https://webflow.com/pricing and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Webflow have AI that generates site content?",
        answer:
          "Webflow does not offer the same AI-first onboarding as Supportsheep. It has a component library and AI-assisted layout tools in development, but starting a Webflow site generally means picking a template or starting from a blank canvas and building out the structure manually. Supportsheep's AI generates a multi-page site -- copy, service descriptions, imagery from Unsplash -- from a single business description prompt.",
      },
      {
        question: "Can I run a blog on Webflow?",
        answer:
          "Yes. Webflow has a CMS that supports dynamic collections, so you can build a fully functional blog with categories, authors, and custom fields. It requires setting up CMS collections and binding fields to page elements, which takes design knowledge. Supportsheep's blog (when enabled in a deployment) drafts posts via AI inside a Blog Feed section and includes an SEO sidebar. For non-technical bloggers, Supportsheep's blog is simpler; for editorial teams with design resources, Webflow's CMS is more flexible.",
      },
      {
        question: "Does Webflow include hosting?",
        answer:
          "Yes. Webflow hosts your published site on its CDN. Site plans cover hosting. The Basic plan ($18/mo annual) hosts static sites; CMS and above host dynamic content. You can also export the HTML/CSS code and host elsewhere, which is a major portability advantage Webflow has over most hosted builders including Supportsheep.",
      },
      {
        question: "Is Supportsheep a Webflow alternative for a supportsheeppreneur?",
        answer:
          "The honest answer: Webflow is not really in Supportsheep's competitive set. Supportsheep is aimed at non-technical supportsheep practitioners who need a site in minutes. Webflow is aimed at designers and development-adjacent marketers who want full control. If you are a supportsheeppreneur without design skills, Supportsheep, Squarespace, or Wix are more appropriate. If you are a freelance designer building client sites, Webflow is the more powerful tool. The product doc's own framing: Supportsheep is an alternative to 'I'll just get it done.'",
      },
    ],
  },
  durable: {
    tldr: "Durable and Supportsheep are the two most AI-first website builders in this category -- both generate a full site from a short business description in under a minute. The clearest difference is what comes bundled: Durable's Launch plan ($22/mo annual) includes CRM, invoicing, a social-post generator, and a Google Ads generator alongside the website, making it an all-in-one small-business tool. Supportsheep does not include those business tools natively but pairs a deeper AI-seeded editing experience with a privacy-first approach. Custom domain on Supportsheep's free plan is also a meaningful advantage; Durable requires a paid plan for that.",
    chooseSupportsheepIf:
      "You want AI to generate your initial site and continue seeding new sections as you build (Supportsheep's section-creation AI persists past onboarding). You prefer to use best-in-class standalone tools for CRM and invoicing -- Notion, HubSpot free, Wave -- rather than having them bundled. You value having a connected custom domain at no cost, and a privacy-first stance matters to you or your audience.",
    chooseCompetitorIf:
      "You want one subscription to cover your website, CRM, invoicing, and marketing tools without stitching together separate services. Durable's bundled CRM tracks client contacts and its invoicing tool is particularly useful for service-based supportsheeppreneurs who need basic billing. If the bundled tools are genuinely ones you would use, the value density of Durable's Launch plan is hard to beat.",
    faqs: [
      {
        question: "How are Durable and Supportsheep different if both use AI?",
        answer:
          "Both generate an initial site from a business description in roughly 30 seconds. The difference is in depth. Supportsheep's AI continues into the editor: adding a new section (introduction, services, FAQ, etc.) calls a per-section generator that seeds content from your business context. Durable's AI is primarily a generation-at-onboarding tool; the bundled value shifts to CRM, invoicing, and marketing tools after that. Supportsheep has no CRM or invoicing bundled. Verified against the upstream repo and Durable's pricing page, 2026-04-21.",
      },
      {
        question: "How do Durable and Supportsheep compare on price?",
        answer:
          "Durable's Launch plan is $22/mo billed annually ($25/mo monthly). Supportsheep's Pro plan is {{supportsheep.pro.yearly}}/mo billed annually ({{supportsheep.pro.monthly}}/mo monthly). Supportsheep's free plan connects one custom domain; Durable's free plan uses a Durable subdomain and requires a paid plan for a custom domain. At the paid tier, Durable and Supportsheep are priced similarly, but Durable bundles more (CRM, invoicing, ad generator) while Supportsheep keeps the scope narrower. Sources: https://durable.com/pricing and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Durable have a built-in CRM?",
        answer:
          "Yes. Durable's Launch plan includes a CRM with unlimited contacts, which is its clearest advantage over Supportsheep. Supportsheep does not ship a native CRM. If client relationship management in one dashboard matters, Durable has the edge. If you already use a standalone CRM (HubSpot, Notion, or a spreadsheet), that advantage disappears.",
      },
      {
        question: "Does Supportsheep have a free plan? Does Durable?",
        answer:
          "Supportsheep's free plan includes a connected custom domain, published sites up to the plan limit, and AI-generated onboarding. Durable's free plan puts your site on a durable.site subdomain with limited features and no custom domain. Check https://supportsheep.com/pricing and https://durable.com/pricing for current limits.",
      },
      {
        question: "Is Durable good for scheduling or bookings?",
        answer:
          "Durable does not include a native booking or appointment system either. Like Supportsheep, it is primarily a website and marketing tool, not a practice management platform. Supportsheep's scheduling section accepts a third-party booking URL (Calendly, Google Calendar). For native booking with calendar availability and payment collection, Acuity Scheduling (via Squarespace) or a dedicated tool is needed.",
      },
      {
        question: "Who is Durable built for?",
        answer:
          "Durable targets the same ICP as Supportsheep: independent practitioners and micro-businesses who need a professional site without technical skills. Where Durable differentiates is small businesses that want invoicing and basic CRM in the same monthly subscription as their website. If that description fits you and you would actually use those tools, Durable is worth evaluating seriously.",
      },
    ],
  },
  framer: {
    tldr: "Framer is a design tool first and a website builder second. It gives designers and marketers the ability to create polished, interactive marketing sites with animations, CMS collections, and pixel-level layout control -- all without writing production code. Supportsheep is built for the opposite user: someone without design experience who wants AI to generate a site from a business description in minutes. These two tools serve different people, and it is rarely a genuine either-or choice.",
    chooseSupportsheepIf:
      "You are a supportsheeppreneur or small business owner without design skills who wants a professional-looking site generated from a prompt. You have a short content footprint -- a few service pages, a blog, and a contact form -- and want to be live quickly. You care about having a custom domain on the free plan and are comfortable with a simpler, section-based editor.",
    chooseCompetitorIf:
      "You are a designer, marketer, or front-end developer who wants pixel-level layout control, advanced animations, and a CMS for dynamic marketing content. Framer's Basic plan starts at just $10/mo (annual billing), making it accessible even for freelancers. If your site needs to impress clients or showcase visual work, Framer's output quality is difficult to match.",
    faqs: [
      {
        question: "Is Framer hard to use for non-designers?",
        answer:
          "Yes, for most non-designers. Framer exposes a design canvas with layers, auto-layout, responsive breakpoints, and component variants. The learning path is similar to Figma's -- powerful once learned, intimidating to start. Supportsheep's editor takes a section-based approach with no blank canvas: sections are predefined types you configure and reorder, which is far less flexible but requires no design knowledge to produce a clean result.",
      },
      {
        question: "How does Framer pricing compare to Supportsheep?",
        answer:
          "Framer's Free plan publishes to a .framer.app subdomain with no custom domain. Basic is $10/mo (annual), Pro is $30/mo (annual), Scale is $100/mo (annual). Supportsheep's free plan includes a custom domain; Pro is {{supportsheep.pro.yearly}}/mo billed annually. If a custom domain is a day-one requirement, Framer's Basic ($10/mo) versus Supportsheep Pro ({{supportsheep.pro.yearly}}/mo) is the relevant comparison. Sources: https://www.framer.com/pricing and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Framer have AI to generate a website?",
        answer:
          "Framer has introduced AI site generation tools that can scaffold a starter site from a prompt. However, the output is a starting point in Framer's visual editor, and making it look polished requires design skill. Supportsheep's AI generation is designed for non-designers: the generated site is directly usable as a first draft without design knowledge.",
      },
      {
        question: "Can I run a blog on Framer?",
        answer:
          "Yes. Framer supports CMS collections that work well for blog content -- create a Blog collection, define fields, and Framer generates the list and detail pages. It requires setup time and familiarity with CMS collection binding in Framer. Supportsheep's blog (when enabled) allows drafting posts via AI within a Blog Feed section and includes an SEO sidebar. Framer's blog is more flexible editorially; Supportsheep's is simpler to operate.",
      },
      {
        question: "Does Framer support ecommerce?",
        answer:
          "No. Framer does not have native ecommerce. You can embed a Stripe payment link, a Gumroad store, or a third-party checkout, but there is no product catalog or inventory management. If ecommerce is a requirement, Webflow, Squarespace, or Shopify are better-suited platforms.",
      },
      {
        question: "Is Framer a good fit for a local service business?",
        answer:
          "Only if you have design skills or can hire someone to build the site. Framer's value is in the output quality and control it gives designers. For a plumber, consultant, or yoga instructor who needs to be online this week without hiring a designer, Supportsheep's AI onboarding is the faster and more appropriate path.",
      },
    ],
  },
  hostinger: {
    tldr: "Hostinger Website Builder is one of the most affordable AI-powered website builders on the market, with genuine AI generation and a free domain bundled into its paid plans. It is a strong pick for cost-conscious small businesses who want to stay under $17/mo including hosting, domain, and SSL. Supportsheep's advantage is its free plan with a custom domain -- Hostinger has no free plan -- and its AI-seeded section creation that continues beyond onboarding. At the paid tier, both are competitive; the choice often comes down to whether you want Hostinger's deeper hosting ecosystem or Supportsheep's privacy-first posture.",
    chooseSupportsheepIf:
      "You want a working site with a connected custom domain at zero cost before you commit to a paid plan. You want AI to continue seeding new sections as you build out the site beyond the initial generation. Supportsheep's free plan and privacy-first positioning are meaningful to you.",
    chooseCompetitorIf:
      "Budget is the primary driver and you are comfortable committing to an annual plan. Hostinger's paid plans are among the cheapest in this category, and they bundle domain, SSL, and email into one low monthly bill. If you also need basic hosting features -- FTP access, email inboxes, or PHP for embedded scripts -- Hostinger's infrastructure is more capable than Supportsheep's managed builder.",
    faqs: [
      {
        question: "Is Hostinger's website builder actually AI-powered?",
        answer:
          "Yes. Hostinger includes an AI website builder that generates an initial site from a business description, similar to Supportsheep's onboarding. It also bundles an AI content writer for copy assistance. The key difference from Supportsheep: Hostinger's AI is primarily an onboarding and content-generation tool. Supportsheep's AI also seeds new sections in the editor as you continue building, using your existing business context.",
      },
      {
        question: "How does Hostinger pricing compare to Supportsheep?",
        answer:
          "Hostinger's Premium plan is $10.99/mo and Business is $16.99/mo at renewal (annual billing). Introductory rates can be much lower, but they increase at renewal -- factor the renewal price into any multi-year commitment. Supportsheep's Pro plan is {{supportsheep.pro.yearly}}/mo billed annually ({{supportsheep.pro.monthly}}/mo monthly). Supportsheep also has a free plan with a connected custom domain; Hostinger does not. Sources: https://www.hostinger.com/pricing/website-builder and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Hostinger include a free domain?",
        answer:
          "Hostinger's annual plans include a free domain for the first year. At renewal, the domain is billed separately at standard registrar rates (typically $10-15/year for a .com). Supportsheep's free plan connects one custom domain you already own; it does not register the domain for you. If you need domain registration, hosting, and a site builder from one provider, Hostinger's bundled offer is convenient.",
      },
      {
        question: "Is Hostinger's website builder good for SEO?",
        answer:
          "Hostinger includes basic SEO features -- meta title and description editing, clean URLs, sitemap generation, and mobile-responsive output. The Business plan adds an SEO toolkit with keyword suggestions. Supportsheep generates on-page SEO primitives at generation time and the blog (when enabled) can draft posts via AI. Neither is a full SEO platform; for serious SEO work, a dedicated CMS or tool is recommended.",
      },
      {
        question: "Does Hostinger have a trial or free plan?",
        answer:
          "Hostinger does not offer a free plan. It provides a 30-day money-back guarantee, which functions as a risk-free trial. Supportsheep's free plan is permanent -- you can publish a site with a custom domain, create sections, and use AI onboarding without paying. If testing before committing to any cost is important, Supportsheep's free plan is the more accessible starting point.",
      },
      {
        question: "Can I use Hostinger for more than a website builder -- hosting PHP, email, FTP?",
        answer:
          "Yes, and this is a genuine Hostinger strength. Hostinger's web hosting infrastructure supports PHP, MySQL, FTP access, and professional email inboxes. If you eventually want to run a WordPress site, a custom PHP application, or self-hosted tools alongside your website builder site, Hostinger's hosting ecosystem scales to that. Supportsheep is a managed closed builder with no server access, custom code beyond embedded snippets (custom code on paid plans), or server-side environment.",
      },
    ],
  },
  weebly: {
    tldr: "Weebly is an established drag-and-drop builder owned by Square, and its primary differentiator today is the tight integration with Square POS for businesses that sell online and in person. It is a solid, affordable option for micro-businesses already in the Square ecosystem. Supportsheep's advantages are AI-guided onboarding (Weebly has none) and a free plan with a connected custom domain. Weebly has seen slower product development since its acquisition; teams building for the long term should weigh that against Supportsheep's backing.",
    chooseSupportsheepIf:
      "You want AI to generate your site structure and copy from a business description, not a blank template. You need a custom domain connected on a free plan to test before paying. You are building primarily a service or content site, not a retail store.",
    chooseCompetitorIf:
      "You already use Square for in-person payments and want your online store synced to the same inventory and POS system. Weebly's Square integration is its clearest advantage -- a coffee shop, boutique, or market vendor that rings up sales in-store and also sells online benefits from one inventory layer. Weebly's simpler editor is also well-suited to users who find other builders overly complex.",
    faqs: [
      {
        question: "Is Weebly still actively developed?",
        answer:
          "Weebly was acquired by Square (now Block) in 2018. Since then, product updates have slowed compared to competitors. The core editor remains functional but has not kept pace with the AI features, template quality, or CMS capabilities of more actively developed builders. Square has been investing more heavily in its own commerce products. Weebly is a stable platform but not one that is visibly accelerating.",
      },
      {
        question: "Does Weebly have AI for site creation?",
        answer:
          "No. Weebly does not offer AI-guided onboarding or section generation. You start from a template and fill it in manually using a drag-and-drop interface. Supportsheep's AI onboarding generates a first draft of your site -- copy, service descriptions, section structure -- from a short business description, which saves significant initial setup time for non-designers.",
      },
      {
        question: "How does Weebly pricing compare to Supportsheep?",
        answer:
          "Weebly's plans: Free (subdomain only, limited features), Personal $10/mo, Professional $12/mo, Performance $26/mo -- all annual billing. Supportsheep's free plan connects one custom domain; Pro is {{supportsheep.pro.yearly}}/mo billed annually. Weebly's free plan does not connect a custom domain. Sources: https://www.weebly.com/pricing and https://supportsheep.com/pricing.",
      },
      {
        question: "Does Weebly work well for ecommerce?",
        answer:
          "Weebly handles simple product catalogs well, especially when integrated with Square POS. The Performance plan ($26/mo) removes transaction fees and adds abandoned-cart email and real-time shipping rates. For larger catalogs, complex shipping rules, or subscription products, Shopify is the stronger platform. Supportsheep's ecommerce is designed for simple storefronts; if a store with significant volume or in-person sales is the core use case, Weebly's Square integration has real value.",
      },
      {
        question: "Can I migrate from Weebly to Supportsheep?",
        answer:
          "Weebly allows you to export your content as a ZIP file of HTML pages and assets, which gives you your text and images in a portable format. There is no one-click import into Supportsheep. The practical workflow: run Supportsheep's AI onboarding with your business description to generate a new site, then copy in any content you want to keep and re-upload media. Point your domain to Supportsheep and set 301 redirects from old Weebly URLs to preserve search rankings.",
      },
      {
        question: "Does Weebly offer a free plan?",
        answer:
          "Yes. Weebly's free plan lets you build a site on a weebly.com subdomain with unlimited pages, SSL, and basic features. However, it shows Weebly branding and does not support a custom domain. Supportsheep's free plan is more generous: it connects one custom domain and does not add Supportsheep branding to your published pages.",
      },
    ],
  },
  "wordpress-com": {
    tldr: "WordPress.com is the managed-hosting version of the world's most popular publishing platform, powering a significant share of the web's blogs and content sites. Its blog and CMS tools are industry-leading. Supportsheep is an AI-first site builder aimed at supportsheeppreneurs who want a generated first draft, not a content platform they build manually. If high-volume content, a large plugin ecosystem, or long-term content publishing flexibility is the priority, WordPress.com is the stronger choice. If getting a service or landing page site live in an afternoon without technical setup is the goal, Supportsheep is faster.",
    chooseSupportsheepIf:
      "You are a supportsheeppreneur or small service business that needs a multi-page site generated from a prompt, not a content platform built manually from a theme. Your site is primarily a service or lead-generation tool with a narrow content footprint and you want AI to handle the initial structure. Supportsheep's free plan with a connected custom domain is also a meaningful advantage -- WordPress.com's free plan uses a .wordpress.com subdomain.",
    chooseCompetitorIf:
      "Content publishing is the core function of your site and you need the world's most mature editorial workflow: scheduled posts, category taxonomy, comment management, editorial roles, and the full plugin ecosystem for SEO (Rank Math, Yoast), forms (Gravity Forms), and analytics. The Business plan ($40/mo) and above open the full WordPress plugin library. If you ever plan to migrate to self-hosted WordPress.org, WordPress.com is the natural on-ramp.",
    faqs: [
      {
        question: "What is the difference between WordPress.com and WordPress.org?",
        answer:
          "WordPress.org is open-source software you download and run on your own hosting. WordPress.com is a managed hosting service run by Automattic that runs WordPress for you. WordPress.com restricts plugin installation to Business plan and above, and you have less server-level control. The benefit: no server administration, automatic updates, and managed security. Supportsheep is also fully managed and hosted -- neither Supportsheep nor WordPress.com gives you server access.",
      },
      {
        question: "How does WordPress.com pricing compare to Supportsheep?",
        answer:
          "WordPress.com: Free (1 GB, .wordpress.com subdomain), Personal $9/mo, Premium $18/mo, Business $40/mo, Commerce $70/mo -- all annual billing. Supportsheep: free plan with custom domain, Pro {{supportsheep.pro.yearly}}/mo, Grow {{supportsheep.grow.yearly}}/mo -- annual billing. The catch: WordPress.com's plugin access (for SEO plugins, WooCommerce, contact form plugins) only unlocks at Business ($40/mo), which makes the middle tiers less compelling for technically oriented users. Sources: https://wordpress.com/pricing/ and https://supportsheep.com/pricing.",
      },
      {
        question: "Does WordPress.com have AI writing tools?",
        answer:
          "WordPress.com includes Jetpack AI on paid plans, which provides writing assistance within the block editor -- helping draft, summarize, and rewrite content. Supportsheep's AI operates at three touchpoints: onboarding (full site generation), section creation (AI-seeded content per section type), and blog post drafting when the blog is enabled. Supportsheep does not ship a free-form AI rewriter for selected text; if you want to highlight a paragraph and ask AI to improve it on demand, Jetpack AI on WordPress.com provides that.",
      },
      {
        question: "Is WordPress.com good for a small service business?",
        answer:
          "It can be, especially if you anticipate significant content volume over time. For a service business that primarily needs a few static pages and a contact form with minimal ongoing content, WordPress.com's setup overhead -- picking a theme, configuring the block editor, learning the dashboard -- is more than most supportsheeppreneurs want. Supportsheep's AI onboarding removes that setup: it generates pages, service descriptions, and copy in one flow and you launch faster. For a therapist, consultant, or tradesperson whose site is primarily a credibility and contact tool, Supportsheep's speed advantage is meaningful.",
      },
      {
        question: "Can I run ecommerce on WordPress.com?",
        answer:
          "Yes, via WooCommerce on the Commerce plan ($70/mo). WordPress.com's Commerce plan is a full-featured ecommerce option with WooCommerce integration, shipping plugins, tax tools, and payment processors. Supportsheep's ecommerce is suited to simple small catalogs -- it is not a WooCommerce replacement. If a serious online store is the primary use case, WordPress.com Commerce or Shopify are the right tools.",
      },
      {
        question: "Can I migrate from WordPress.com to WordPress.org self-hosted later?",
        answer:
          "Yes. WordPress.com's export tool produces a WordPress-compatible XML of all your content, which imports cleanly into a self-hosted WordPress installation. This portability is WordPress.com's strongest long-term advantage: you are never locked in to the managed platform. Supportsheep's export options are more limited -- migrating out involves manual copy-paste and media re-upload, similar to other hosted builders.",
      },
      {
        question: "Does Supportsheep replace WordPress.com for blogging?",
        answer:
          "No -- not if blogging is the primary activity. WordPress.com's editorial tooling (post scheduling, categories, comment management, editorial roles, full RSS, newsletter integration) is purpose-built for high-volume content publishing. Supportsheep's blog (when enabled) is suited for a small number of AI-drafted posts attached to a service site. If you plan to publish consistently -- multiple posts per week, multiple authors, a newsletter audience -- WordPress.com is the right foundation.",
      },
    ],
  },
  carrd: {
    tldr: "Carrd is the most affordable single-page website builder available -- Pro Standard with a custom domain costs just $19 per year, making it hard to beat on price. But it is single-page only: no multi-page site, no blog, no contact forms without Pro Plus, and no ecommerce beyond a Stripe embed. Supportsheep generates multi-page business sites with AI, includes a blog when enabled, and connects a custom domain on the free plan. If you need more than one page, Carrd is not the right tool.",
    chooseSupportsheepIf:
      "You need a multi-page service site -- an about page, services page, blog, and contact form -- generated quickly from a business description. You want AI to seed the structure and copy so you are not starting from a blank template. Custom domain on a free plan matters to you.",
    chooseCompetitorIf:
      "Your entire web presence fits on a single page -- a link-in-bio, a personal profile, a portfolio landing page, or a simple 'hire me' page -- and cost minimization is the priority. At $19/year for custom domain support, Carrd is one of the most cost-effective tools in existence for its use case.",
    faqs: [
      {
        question: "What is Carrd best for?",
        answer:
          "Carrd excels at single-page sites: personal profiles, link-in-bio pages, portfolios with one scroll, simple landing pages, and minimal 'hire me' sites for freelancers. Its constrained scope is the product -- it does one thing well and keeps costs exceptionally low. If any of those formats describes what you need, Carrd is worth serious consideration.",
      },
      {
        question: "How does Carrd pricing compare to Supportsheep?",
        answer:
          "Carrd bills annually: Free ($0), Pro Lite ($9/year, no custom domain), Pro Standard ($19/year, custom domain), Pro Plus ($49/year, forms and embeds). Supportsheep's free plan includes a connected custom domain (check https://supportsheep.com/pricing for current limits). Supportsheep's Pro plan is {{supportsheep.pro.yearly}}/mo billed annually, which is $240/year -- more than Carrd's top tier. Carrd is meaningfully cheaper if its single-page constraint works for you. Sources: https://carrd.co/pro and https://supportsheep.com/pricing.",
      },
      {
        question: "Can Carrd do multi-page sites?",
        answer:
          "No. Carrd is fundamentally single-page. A Carrd site scrolls down but does not have multiple distinct page routes (e.g., /about, /services, /blog). If you need a proper multi-page business site with a separate services page, contact page, and blog, Carrd is not the right tool and Supportsheep, Squarespace, or Wix are more appropriate.",
      },
      {
        question: "Does Carrd have a blog?",
        answer:
          "No. Carrd has no blog functionality. It renders a single page of content; there is no CMS, post editor, or dynamic content listing. If a blog is part of your site plan, Carrd is not suitable.",
      },
      {
        question: "Can I add a contact form to Carrd?",
        answer:
          "Contact forms require the Pro Plus plan ($49/year), which includes form submission handling via Carrd or forwarding to external services like Netlify Forms or Formspark. The Free and Pro Lite plans do not include form submissions. Supportsheep's contact forms are included on paid plans and are part of the generated section types at onboarding.",
      },
      {
        question: "Is Carrd good for SEO?",
        answer:
          "Carrd produces clean, fast-loading single pages with meta title and description support. For a single-page site the SEO ceiling is lower than a multi-page site by definition -- there are fewer pages to rank and no blog to build topical authority. Supportsheep's multi-page structure, blog (when enabled), and on-page SEO primitives give it more surface area for search engine visibility.",
      },
    ],
  },
  jimdo: {
    tldr: "Jimdo and Supportsheep overlap more than most competitors in this space -- both use AI to generate a first-draft site from a short business description, both target non-technical small business owners, and both offer a free tier. Jimdo's free plan is more restricted (5-page cap, subdomain only), and its Start plan with a custom domain is $11/mo -- cheaper than Supportsheep's Pro tier. Jimdo has not kept pace with competitors on AI depth and template quality, so for users who care about the editor experience beyond onboarding, Supportsheep and Squarespace are stronger choices.",
    chooseSupportsheepIf:
      "You want AI to continue seeding new sections as you build beyond the initial generation, and you care about the quality of the section and template system. Supportsheep's free-plan custom domain and reliable backing are also meaningful advantages. If the site will include a blog with AI-drafted posts, Supportsheep's blog feature (when enabled) is more developed than Jimdo's.",
    chooseCompetitorIf:
      "Budget is the primary driver and you want a basic AI-generated multi-page site for as little as $11/mo with a custom domain. Jimdo's Start plan is affordable, and for a simple service business that just needs to be found online, it covers the basics. Jimdo also has a longer track record and a user base with reviews spanning many years.",
    faqs: [
      {
        question: "Does Jimdo use AI to build websites?",
        answer:
          "Yes. Jimdo's primary builder -- Jimdo Dolphin -- uses AI to generate a website from a few onboarding questions. It asks about your business type, name, and basic preferences, then assembles a starter site. Supportsheep's AI onboarding is similar in approach but goes deeper: it takes a full business description prompt, generates multiple pages with copy, service descriptions, and imagery sourced from Unsplash, and then continues seeding new sections in the editor.",
      },
      {
        question: "How does Jimdo pricing compare to Supportsheep?",
        answer:
          "Jimdo: Play $0/mo (5-page cap, subdomain), Start $11/mo (custom domain, 10 pages), Grow $17/mo (50 pages), Unlimited $45/mo. Supportsheep: free plan with custom domain, Pro {{supportsheep.pro.yearly}}/mo billed annually. Jimdo's Start plan at $11/mo is meaningfully cheaper than Supportsheep's Pro tier for a custom-domain site. If Jimdo's feature set meets your needs, that price difference is real. Sources: https://www.jimdo.com/pricing/website/ and https://supportsheep.com/pricing.",
      },
      {
        question: "What are Jimdo's limitations?",
        answer:
          "Jimdo's main limitations: the AI onboarding is less polished than newer AI-first builders; the template library has not been refreshed as consistently as Squarespace or Wix; design flexibility is limited; and the free plan's 5-page cap makes it unsuitable for anything beyond the most minimal sites. Jimdo's product velocity has also slowed relative to competitors.",
      },
      {
        question: "Does Jimdo have a blog?",
        answer:
          "Yes, basic blog functionality is available on Jimdo's paid plans. It is simpler than WordPress's editorial tools and does not include AI post drafting. Supportsheep's blog (when enabled in a deployment) can draft posts via AI within a Blog Feed section.",
      },
      {
        question: "Can I sell online with Jimdo?",
        answer:
          "Jimdo offers separate online store plans (Basic $18/mo, Business $26/mo, VIP $45/mo) that include product management, payment processing, and shipping. These are distinct from the website plans. Supportsheep's storefront is suited to simple small catalogs. If you need inventory management, product variants, or discount codes, Jimdo's store plans or Shopify are more appropriate.",
      },
      {
        question: "Is Jimdo good for local service businesses?",
        answer:
          "Yes, and this is Jimdo's core use case. A local plumber, cleaning service, or personal trainer with a 5-10 page site, a contact form, and basic SEO is well-served by Jimdo's Start plan at $11/mo. For those same businesses, Supportsheep's AI-generated multi-page site and free custom domain provide a faster and higher-quality starting point, but at a higher cost on paid plans.",
      },
    ],
  },
  ionos: {
    tldr: "IONOS Website Builder is a reliable but understated platform from one of Europe's largest web infrastructure companies. Its paid plans bundle a custom domain, SSL, and professional email -- practical all-in-ones for a small business. The Pro plan includes A/B testing and heat maps, which is rare at this price point. Supportsheep has the edge on AI-guided onboarding depth and free-plan custom domain access; IONOS has an advantage for businesses that want email hosting and infrastructure from a single provider with a European data center presence.",
    chooseSupportsheepIf:
      "You want AI to generate your full site structure and copy from a business description at onboarding, and to continue seeding new sections as you build. Supportsheep's free plan with a connected custom domain is a meaningful advantage -- IONOS has no genuine free plan. A privacy-first posture matters to you or your audience.",
    chooseCompetitorIf:
      "You want domain, hosting, and professional email bundled into one monthly bill from an established European provider. IONOS's Pro plan ($30/mo) with heat maps and A/B testing offers analytics tools that few builders include at that price. If you are an EU-based business where data residency and provider reputation matter, IONOS is a credible choice.",
    faqs: [
      {
        question: "Is IONOS a website builder or a web host?",
        answer:
          "Both. IONOS started as a web host (it was formerly 1&1 IONOS) and has since built a managed website builder -- MyWebsite Now -- on top of its infrastructure. Its plans bundle the builder, hosting, domain registration, and email inboxes. This is a genuine convenience advantage for businesses that want one provider for everything, but the website builder itself is less polished than specialist builders like Squarespace or Wix.",
      },
      {
        question: "Does IONOS have AI features?",
        answer:
          "IONOS includes an AI website generator for the initial site setup and some AI-assisted content writing tools. The depth of AI integration is less than dedicated AI-first builders like Supportsheep or Durable. Supportsheep's AI generates a full multi-page site at onboarding and continues seeding new sections in the editor; IONOS's AI is primarily a starting-point generator.",
      },
      {
        question: "How does IONOS pricing compare to Supportsheep?",
        answer:
          "IONOS MyWebsite Now: Starter $12/mo, Plus $18/mo, Pro $30/mo -- annual billing at regular rates. (IONOS advertises $1/mo introductory offers; factor in the renewal rate for a realistic cost assessment.) Supportsheep: free plan with custom domain, Pro {{supportsheep.pro.yearly}}/mo billed annually. Sources: https://www.ionos.com/websites/website-builder and https://supportsheep.com/pricing.",
      },
      {
        question: "Does IONOS include email hosting?",
        answer:
          "Yes. All IONOS paid plans include at least one professional email inbox (e.g., name@yourbusiness.com). This is an IONOS strength -- most dedicated website builders do not bundle email. Supportsheep does not include email hosting. If a professional email address from your domain is a requirement and you want it bundled with your website, IONOS has a clear advantage.",
      },
      {
        question: "Is IONOS available outside Europe?",
        answer:
          "Yes. IONOS operates in the US, UK, Germany, France, Spain, and several other countries. It is well-established in the US market under the IONOS brand. Pricing varies by country. For EU-based businesses that want European data residency and GDPR-aligned infrastructure, IONOS is one of the stronger providers in this category.",
      },
      {
        question: "Does IONOS have a free plan?",
        answer:
          "IONOS's heavily advertised $1/mo introductory pricing is not a free plan -- it is a promotional rate that reverts to standard pricing at renewal. There is no permanent free tier. Supportsheep's free plan includes a connected custom domain and AI onboarding at no cost. Check https://supportsheep.com/pricing for current free-tier limits.",
      },
    ],
  },
  "10web": {
    tldr: "10Web and Supportsheep both use AI to generate website content from a business description, but the underlying output is completely different. 10Web generates a WordPress site -- you get a real WordPress installation, full plugin access, and WooCommerce capability, hosted on 10Web's infrastructure with automated PageSpeed optimization. Supportsheep is a closed hosted builder with no WordPress portability. Choose Supportsheep if you want simplicity and speed; choose 10Web if you want the long-term flexibility of WordPress and are comfortable with its ecosystem.",
    chooseSupportsheepIf:
      "You want the simplest possible managed experience: no plugins to update, no WordPress security patches, no hosting configuration. Supportsheep's section-based editor is more constrained but significantly easier to operate for non-technical users. If you are building a service site or portfolio with a narrow content footprint, Supportsheep's AI onboarding and editor get you there faster.",
    chooseCompetitorIf:
      "You want AI to bootstrap a WordPress site so you end up owning a portable, standards-based CMS you can extend indefinitely. 10Web's PageSpeed optimization is a genuine differentiator -- automated scoring of 90+ is hard to achieve manually. If WooCommerce, the WordPress plugin library, or eventual migration to self-hosted WordPress are part of your plan, 10Web is the right starting point.",
    faqs: [
      {
        question: "Does 10Web output a real WordPress site?",
        answer:
          "Yes. 10Web's AI builder generates a WordPress site hosted on 10Web's infrastructure. You get a standard WordPress admin dashboard, full theme editing, access to the plugin repository, and the ability to install WooCommerce or any other plugin. The output is portable -- you can migrate to any WordPress host. Supportsheep's output is not portable in this way; it lives on Supportsheep's managed platform.",
      },
      {
        question: "How does 10Web pricing compare to Supportsheep?",
        answer:
          "10Web's single-site business plans: AI Starter $10/mo, AI Premium $15/mo, AI Ultimate $23/mo -- all annual billing with a 7-day free trial. Supportsheep: free plan with custom domain, Pro {{supportsheep.pro.yearly}}/mo billed annually. 10Web's entry plan is less expensive than Supportsheep's Pro tier, but Supportsheep has a permanent free plan. Sources: https://10web.io/pricing-platform/ and https://supportsheep.com/pricing.",
      },
      {
        question: "Is 10Web easier to use than self-hosted WordPress?",
        answer:
          "Yes, significantly. 10Web handles server configuration, WordPress installation, automated updates, backups, and the PageSpeed optimization stack. You still get a WordPress dashboard, which has a learning curve, but the infrastructure layer is managed. Supportsheep is simpler still -- there is no WordPress admin, no plugin management, and a section-based editor that requires no technical knowledge.",
      },
      {
        question: "Does 10Web include ecommerce?",
        answer:
          "Yes, via WooCommerce. 10Web offers separate AI Ecommerce plans (starting at $11/mo) that include WooCommerce pre-installed and configured. This is a meaningful advantage over Supportsheep for anyone running a real store: WooCommerce supports complex product catalogs, subscriptions, variable products, and hundreds of payment gateways. Supportsheep's storefront is suited to simple small catalogs.",
      },
      {
        question: "What are the risks of choosing 10Web?",
        answer:
          "The main trade-off is WordPress's ongoing maintenance burden. Even with 10Web managing the server, you are responsible for keeping plugins updated, reviewing security notices, and understanding the WordPress ecosystem. If a plugin breaks your site, that is your problem to debug. Supportsheep abstracts all of that away -- there are no plugins to manage and the platform handles all updates.",
      },
      {
        question: "Can I migrate a 10Web site to self-hosted WordPress later?",
        answer:
          "Yes. Because 10Web's output is standard WordPress, migration to any WordPress-compatible host (Kinsta, WP Engine, SiteGround, a VPS) is straightforward using a plugin like All-in-One WP Migration or a manual database and file transfer. This is one of the strongest long-term arguments for 10Web: you are never locked into 10Web's hosting specifically.",
      },
    ],
  },
  "sites-google": {
    tldr: "Google Sites is a free, no-frills website builder that comes with every Google account and integrates natively with Google Workspace. It is excellent for internal sites, simple team intranets, school projects, and event pages. It is not suited to public-facing business websites: no custom domain support without workarounds, no blog, no contact forms, no ecommerce, minimal design options, and no AI generation. Supportsheep is designed specifically for the public-facing business site use case that Google Sites cannot serve.",
    chooseSupportsheepIf:
      "You need a professional public-facing website for your business, service, or freelance practice. You want AI to generate your site structure and copy, a blog to support content marketing, a contact form to capture leads, and a custom domain connected at no cost. Google Sites cannot deliver any of these things reliably.",
    chooseCompetitorIf:
      "You need a simple internal site -- a team resource hub, a class website, a project landing page for an organization already on Google Workspace -- and you want zero additional cost. Google Sites is genuinely excellent at frictionless internal pages where branding and SEO are not requirements. If your team already uses Google Docs and Slides daily, Google Sites pages are maintained with zero learning curve.",
    faqs: [
      {
        question: "Is Google Sites free?",
        answer:
          "Yes. Google Sites is free with any Google account. Business users in Google Workspace (starting at $6/user/mo) also have access. There is no paid tier for Google Sites itself -- it is a feature, not a standalone product. Supportsheep's free plan is also free and includes a connected custom domain; Supportsheep has paid plans for expanded features.",
      },
      {
        question: "Can I use a custom domain with Google Sites?",
        answer:
          "Not easily. Google Sites publishes to sites.google.com/[your-path] by default. Mapping a custom domain requires either a Google Workspace admin setup (which involves CNAME configuration and is not available to personal account holders without technical DNS knowledge) or hosting the site on a path and adding a redirect. Supportsheep's free plan connects one custom domain directly in the dashboard with no DNS complexity.",
      },
      {
        question: "Can I add a contact form to Google Sites?",
        answer:
          "Google Sites does not have a native contact form builder. The common workaround is to embed a Google Form into a Sites page, which works but has limited styling and submission handling. Supportsheep's contact forms are first-class: they are part of the generated section types, configurable in the editor, and submissions are delivered to your configured destination.",
      },
      {
        question: "Does Google Sites support a blog?",
        answer:
          "No. Google Sites has no blog functionality, no post editor, and no CMS. It renders static pages. If content publishing -- articles, posts, a blog feed -- is part of your site plan, Google Sites is not the right tool. Supportsheep's blog (when enabled) can draft posts via AI within a Blog Feed section.",
      },
      {
        question: "How does Google Sites compare to Supportsheep on SEO?",
        answer:
          "Google Sites performs poorly for SEO by design. Pages are served from a Google subdomain (not your own domain), there is no meta description editor in the standard interface, and the content structure gives you little control over semantic HTML. Supportsheep generates clean on-page SEO primitives at generation time -- meta titles, descriptions, structured data, sitemaps, and clean URLs on your own domain. For any site where organic search visibility matters, Supportsheep is the significantly stronger platform.",
      },
      {
        question: "Who actually uses Google Sites?",
        answer:
          "Google Sites is most commonly used for: internal team knowledge bases, classroom and school websites in Google Workspace for Education, club and organization pages, and event pages where cost is zero and speed of setup is everything. It is rarely used for public professional business websites because it lacks the features (custom domain, forms, SEO control, design quality) that professional sites require.",
      },
      {
        question: "Is Google Sites a good choice for a freelancer or supportsheeppreneur?",
        answer:
          "Almost never. A Google Sites page on a sites.google.com URL signals that the business has not invested in a basic web presence, which undermines the credibility the site is meant to establish. For a freelancer or supportsheeppreneur, Supportsheep's free plan with a custom domain, AI-generated professional copy, and a contact form delivers everything a Google Sites page cannot -- at no cost.",
      },
    ],
  },
};

export function getCompetitorNarrative(
  slug: string,
): CompetitorNarrative | undefined {
  return NARRATIVES[slug];
}

/**
 * Whether a competitor has a published narrative available for the
 * `/alternatives/<slug>` and `/vs/<slug>` pillar routes. New entries can be
 * added to the registry (for pricing tables, sitemaps of child routes, etc.)
 * before their narrative copy is written; `generateStaticParams` and the
 * sitemap should skip them until then so crawlers do not discover 404s.
 */
export function hasCompetitorNarrative(slug: string): boolean {
  return slug in NARRATIVES;
}
