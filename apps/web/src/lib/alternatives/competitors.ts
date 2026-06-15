/**
 * Competitor registry for the /alternatives and /vs routes.
 *
 * Each record is hand-curated from the competitor's public marketing pages.
 * Every claim must be re-verified before updating `verifiedAt` -- pricing
 * and feature limits change frequently. Keep this file the single source
 * of truth for alternative pages so the sitemap, JSON-LD, and UI stay in sync.
 */

import type { Competitor } from "@repo/types";

export const COMPETITORS: Competitor[] = [
  {
    id: "wix",
    name: "Wix",
    slug: "wix",
    websiteUrl: "https://www.wix.com",
    bestFor:
      "Hands-on visual builders who want granular drag-and-drop control over every pixel of their site.",
    pricingTiers: [
      {
        name: "Light",
        monthlyPrice: "$17/mo",
        summary: "Entry plan for a simple brochure site with a custom domain.",
      },
      {
        name: "Core",
        monthlyPrice: "$29/mo",
        summary: "Adds basic ecommerce, forms, and analytics for small stores.",
      },
      {
        name: "Business",
        monthlyPrice: "$36/mo",
        summary: "Standard online store with accepting online payments and abandoned-cart recovery.",
      },
      {
        name: "Business Elite",
        monthlyPrice: "$159/mo",
        summary: "Higher storage and priority support for growing stores.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Drag-and-drop editor with templates",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Included on paid plans only",
      },
      {
        feature: "Blog / content platform",
        blogbat: "First-class blog with SEO sidebar and AI drafting",
        competitor: "Built-in blog module",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Full ecommerce suite",
        notes: "Wix is the stronger pick for sellers with large catalogs.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "Built-in across the editor and blog",
        competitor: "Available via Wix AI add-ons",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No",
      },
    ],
    prosCons: {
      pros: [
        "Mature drag-and-drop editor with deep template library.",
        "Strong ecommerce feature set including POS and shipping tools.",
        "Large third-party app marketplace.",
      ],
      cons: [
        "No free plan with a connected custom domain.",
        "Editor learning curve can overwhelm non-designers.",
        "Template is locked after first publish -- redesigns mean starting over.",
      ],
    },
    verifiedAt: "2026-04-20",
  },
  {
    // Pricing verified 2026-04-21 via:
    //   - https://www.squarespace.com/blog/squarespace-plans-explained
    //     (confirms the Feb 2026 rename to Basic/Core/Plus/Advanced)
    //   - https://www.websitebuilderexpert.com/website-builders/squarespace-pricing/
    //   - https://tech.co/website-builders/squarespace-pricing
    // Annual-billed effective monthly rates are used to match the Wix entry's
    // "$X/mo" string format. squarespace.com/pricing is client-rendered so
    // the public blog + two independent review sites were cross-checked.
    id: "squarespace",
    name: "Squarespace",
    slug: "squarespace",
    websiteUrl: "https://www.squarespace.com",
    bestFor:
      "Designers and creatives who want highly polished templates with minimal setup.",
    pricingTiers: [
      {
        name: "Basic",
        monthlyPrice: "$16/mo",
        summary:
          "Entry website plan with a free custom domain and Blueprint AI; sells unlimited products with a 2% transaction fee.",
      },
      {
        name: "Core",
        monthlyPrice: "$23/mo",
        summary:
          "0% transaction fee, unlimited contributors, advanced analytics, professional email, and Mailchimp/Zapier integrations.",
      },
      {
        name: "Plus",
        monthlyPrice: "$39/mo",
        summary:
          "For growing stores: 50 hours of video, API access, and lower Squarespace Payments processing rates than Core.",
      },
      {
        name: "Advanced",
        monthlyPrice: "$99/mo",
        summary:
          "For established businesses: unlimited video, lowest payment processing rates, and priority-tier commerce tools.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Template-first editor with polished design defaults",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Free for the first year on annual plans only",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog with AI-drafted posts (feature-flagged); SEO sidebar in the blog CMS",
        competitor: "Built-in blog with categories and scheduling",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Full ecommerce suite with Squarespace Payments",
        notes:
          "Squarespace is the stronger pick for design-led stores and high-volume sellers.",
      },
      {
        feature: "AI content generation",
        blogbat: "AI at onboarding + section creation; no in-editor rewriter",
        competitor: "Blueprint AI for site generation; writing assist is limited",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No",
      },
    ],
    prosCons: {
      pros: [
        "Award-winning template library with best-in-class visual design.",
        "Integrated commerce, scheduling, and email marketing in one suite.",
        "Squarespace Payments keeps checkout and analytics tightly integrated.",
      ],
      cons: [
        "No free plan; paid subscription required once the 14-day trial ends.",
        "Customization outside the template grid requires CSS and can be restrictive.",
        "Blogging and SEO tooling trail dedicated content platforms.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // GoDaddy Website Builder
  // Pricing verified 2026-04-21 via:
  //   - https://www.websiteplanet.com/blog/godaddy-pricing-plans/
  //     (confirms Basic $9.99/mo, Standard $14.99/mo, Premium $16.99/mo,
  //      Ecommerce $29.99/mo when billed annually)
  //   - https://www.godaddy.com/pricing
  // Annual-billed effective monthly rates used throughout.
  // ---------------------------------------------------------------------------
  {
    id: "godaddy",
    name: "GoDaddy Website Builder",
    slug: "godaddy",
    websiteUrl: "https://www.godaddy.com/websites/website-builder",
    bestFor:
      "Small businesses and entrepreneurs who want a quick, guided website setup bundled with GoDaddy's domain and hosting ecosystem.",
    pricingTiers: [
      {
        name: "Basic",
        monthlyPrice: "$9.99/mo",
        summary:
          "Entry-level plan with a custom domain, SSL, and basic site builder features.",
      },
      {
        name: "Standard",
        monthlyPrice: "$14.99/mo",
        summary: "Adds SEO tools, PayPal button, and enhanced marketing features.",
      },
      {
        name: "Premium",
        monthlyPrice: "$16.99/mo",
        summary:
          "Social media integrations, email marketing tools, and Google Workspace access.",
      },
      {
        name: "Ecommerce",
        monthlyPrice: "$29.99/mo",
        summary:
          "Full online store with product reviews, inventory management, and shopping cart.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Guided wizard with templates and section blocks",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Included on paid plans only",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Basic blog module available on paid plans",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Full ecommerce suite on the Ecommerce plan",
        notes: "GoDaddy is the stronger pick for sellers wanting one-stop domain + store.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "GoDaddy Airo AI for site generation and content suggestions",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No",
      },
    ],
    prosCons: {
      pros: [
        "All-in-one ecosystem: domain registration, hosting, email, and site builder from one provider.",
        "GoDaddy Airo AI generates an initial site from a short prompt in minutes.",
        "Strong SEO and marketing tools (email campaigns, Google Ads) bundled on Standard and above.",
      ],
      cons: [
        "No free plan with a custom domain; custom domains require a paid subscription.",
        "Editor is less flexible than competitors like Wix; limited layout control.",
        "Renewal pricing increases significantly after the introductory period.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Webflow
  // Pricing verified 2026-04-21 via:
  //   - https://webflow.com/pricing (client-rendered; cross-checked with)
  //   - https://litextension.com/blog/webflow-pricing/
  //   - https://www.broworks.net/blog/webflow-pricing-breakdown-2026-update
  // Site plans (annual billing) used; workspace plans not included as they are
  // separate billing for design teams.
  // ---------------------------------------------------------------------------
  {
    id: "webflow",
    name: "Webflow",
    slug: "webflow",
    websiteUrl: "https://webflow.com",
    bestFor:
      "Designers and developers who want pixel-level visual control, a built-in CMS, and production-ready HTML/CSS output without writing code.",
    pricingTiers: [
      {
        name: "Basic",
        monthlyPrice: "$18/mo",
        summary: "Static sites with custom domain; no CMS or ecommerce.",
      },
      {
        name: "CMS",
        monthlyPrice: "$23/mo",
        summary:
          "Content-driven sites with up to 2,000 CMS items; ideal for blogs and editorial sites.",
      },
      {
        name: "Business",
        monthlyPrice: "$39/mo",
        summary:
          "High-traffic sites with 10,000 CMS items, 2.5 TB bandwidth, and form file uploads.",
      },
      {
        name: "Enterprise",
        monthlyPrice: "Custom",
        summary: "Custom limits, SSO, advanced security, and dedicated support.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Canvas-based visual editor with full layout control",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Included on paid site plans only",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Built-in CMS with collections, dynamic pages, and editorial workflows",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Separate ecommerce plans starting at $29/mo with 2% transaction fee",
        notes: "Webflow ecommerce is powerful but priced separately from site plans.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "No built-in AI writing assistant; third-party integrations available",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; free plan shows webflow.io subdomain only",
      },
    ],
    prosCons: {
      pros: [
        "Best-in-class visual editor with full CSS control and responsive breakpoints.",
        "Powerful CMS with collections, dynamic pages, and clean exported code.",
        "Large ecosystem of templates, agencies, and third-party integrations.",
      ],
      cons: [
        "Steep learning curve; expects design and layout knowledge from users.",
        "No AI-guided onboarding; starting from scratch requires significant time investment.",
        "More expensive than most website builders once workspace plans are added.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Durable AI
  // Pricing verified 2026-04-21 via:
  //   - https://durable.com/pricing (fetched directly)
  //     (confirms Free $0, Launch $22/mo annual / $25/mo monthly,
  //      Grow $85/mo annual / $99/mo monthly)
  // ---------------------------------------------------------------------------
  {
    id: "durable",
    name: "Durable AI",
    slug: "durable",
    websiteUrl: "https://durable.co",
    bestFor:
      "solopreneurs and micro-businesses who want an AI-generated site plus bundled CRM, invoicing, and marketing tools in one subscription.",
    pricingTiers: [
      {
        name: "Free",
        monthlyPrice: "$0/mo",
        summary:
          "AI-generated site on a Durable subdomain with limited AI features and no custom domain.",
      },
      {
        name: "Launch",
        monthlyPrice: "$22/mo",
        summary:
          "Custom domain, CRM with unlimited contacts, invoicing, social post generator, and Google Ads generator.",
      },
      {
        name: "Grow",
        monthlyPrice: "$85/mo",
        summary: "Everything in Launch plus up to 5 websites and priority support.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "AI generates site in ~30 seconds from a business description",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Paid plans only",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Basic blog included; AI can assist with post drafts",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Basic product listings; not a full ecommerce suite",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "AI throughout -- site generation, content, invoices, and social posts",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; custom domain requires paid plan",
      },
    ],
    prosCons: {
      pros: [
        "Generates a complete website, including copy and imagery, in roughly 30 seconds.",
        "Built-in CRM, invoicing, and AI social-post generator bundled on the Launch plan.",
        "Simple, clean output well-suited to service businesses that just need to get online.",
      ],
      cons: [
        "Less editorial control than traditional builders; customization options are limited.",
        "No free plan with a custom domain.",
        "CRM and business tools are basic -- not a substitute for dedicated CRM software.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Framer
  // Pricing verified 2026-04-21 via:
  //   - https://www.framer.com/pricing (cross-checked with)
  //   - https://onepagelove.com/framer-pricing
  //   - https://goodspeed.studio/blog/framer-pricing-explained
  // Annual-billed site plan rates used throughout.
  // ---------------------------------------------------------------------------
  {
    id: "framer",
    name: "Framer",
    slug: "framer",
    websiteUrl: "https://www.framer.com",
    bestFor:
      "Designers and marketers who want pixel-level control, a built-in CMS, and interactive animations without writing production code.",
    pricingTiers: [
      {
        name: "Free",
        monthlyPrice: "$0/mo",
        summary:
          "Publish to a Framer subdomain; up to 10 CMS collections and 1,000 pages. No custom domain.",
      },
      {
        name: "Basic",
        monthlyPrice: "$10/mo",
        summary: "Custom domain, increased bandwidth, and access to premium templates.",
      },
      {
        name: "Pro",
        monthlyPrice: "$30/mo",
        summary: "Staging environments, more CMS content, advanced interactions, and larger teams.",
      },
      {
        name: "Scale",
        monthlyPrice: "$100/mo",
        summary: "High-traffic sites with large bandwidth allowance and team collaboration tools.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Canvas-based designer with components, grids, and breakpoints",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Paid plans only; free plan uses .framer.app subdomain",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "CMS collections for structured content; no dedicated blog AI",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Not natively supported; requires third-party integration",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "AI site generation available; no inline AI writing assistant",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; custom domain requires paid plan",
      },
    ],
    prosCons: {
      pros: [
        "Best-in-class animation and interaction design without writing code.",
        "Clean, responsive output with a powerful CMS for content-driven marketing sites.",
        "Strong template marketplace and designer community.",
      ],
      cons: [
        "Designed for people with design skills; non-designers face a steep learning curve.",
        "No AI-guided onboarding from a business description -- blank canvas to start.",
        "No native ecommerce support; requires Stripe or third-party checkout integration.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Hostinger Website Builder
  // Pricing verified 2026-04-21 via:
  //   - https://www.hostinger.com/pricing/website-builder (fetched directly)
  //     (confirms Premium $10.99/mo and Business $16.99/mo at renewal, annual)
  //   - https://www.websitebuilderexpert.com/web-hosting/hostinger-pricing/
  // Renewal (non-introductory) rates used to avoid misleading comparisons.
  // ---------------------------------------------------------------------------
  {
    id: "hostinger",
    name: "Hostinger Website Builder",
    slug: "hostinger",
    websiteUrl: "https://www.hostinger.com/website-builder",
    bestFor:
      "Budget-conscious small businesses looking for a fast, AI-assisted website builder bundled with affordable hosting and a free domain.",
    pricingTiers: [
      {
        name: "Premium",
        monthlyPrice: "$10.99/mo",
        summary:
          "AI-powered website builder, free domain for the first year, SSL, and unlimited bandwidth.",
      },
      {
        name: "Business",
        monthlyPrice: "$16.99/mo",
        summary:
          "Everything in Premium plus online store features, AI tools, and priority support.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "AI website builder generates a site from a business description",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Free for the first year on annual paid plans; no free plan",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Basic blog functionality included on paid plans",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Online store available on Business plan",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "Hostinger AI Builder generates sites; AI content writer for copy",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; no free plan offered",
      },
    ],
    prosCons: {
      pros: [
        "Among the most affordable website builders with AI generation included.",
        "Free domain, SSL, and email included on annual plans.",
        "AI content writer and heatmap tools help non-technical users optimize their sites.",
      ],
      cons: [
        "No free plan; 30-day money-back guarantee is the only trial option.",
        "Advertised introductory pricing increases significantly at renewal.",
        "Fewer templates and design flexibility compared to Wix or Squarespace.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Weebly
  // Pricing verified 2026-04-21 via:
  //   - https://www.weebly.com/pricing (cross-checked with)
  //   - https://avada.io/blog/weebly-pricing/
  //   - https://www.tooltester.com/en/reviews/weebly-review/pricing/
  // Annual-billed monthly rates used. Note: Weebly is owned by Square/Block.
  // ---------------------------------------------------------------------------
  {
    id: "weebly",
    name: "Weebly",
    slug: "weebly",
    websiteUrl: "https://www.weebly.com",
    bestFor:
      "Small businesses and sellers already in the Square ecosystem who want a simple drag-and-drop site with basic ecommerce.",
    pricingTiers: [
      {
        name: "Free",
        monthlyPrice: "$0/mo",
        summary:
          "Unlimited pages on a Weebly subdomain with SSL; no custom domain or advanced features.",
      },
      {
        name: "Personal",
        monthlyPrice: "$10/mo",
        summary: "Custom domain for the first year, ad removal, and site search.",
      },
      {
        name: "Professional",
        monthlyPrice: "$12/mo",
        summary: "Video backgrounds, memberships, password protection, and phone support.",
      },
      {
        name: "Performance",
        monthlyPrice: "$26/mo",
        summary:
          "No transaction fees, priority support, abandoned-cart emails, and real-time shipping.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Drag-and-drop editor with templates; no AI generation",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Free for the first year on Personal and above; free plan uses subdomain",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Built-in blog with basic SEO tools",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Square-integrated ecommerce with POS support on paid plans",
        notes: "Weebly's Square integration is its main differentiator for in-person sellers.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "No AI generation or writing assistant",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; free plan uses Weebly subdomain only",
      },
    ],
    prosCons: {
      pros: [
        "Tight integration with Square POS for businesses that sell online and in person.",
        "Simple, approachable drag-and-drop editor well-suited to beginners.",
        "Free plan covers the basics for a simple informational site.",
      ],
      cons: [
        "No AI-guided onboarding; users start from a template, not a generated draft.",
        "Product development has slowed since Square's acquisition; fewer new features.",
        "Free plan shows Weebly subdomain; custom domain requires a paid plan.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // WordPress.com (hosted, not self-hosted)
  // Pricing verified 2026-04-21 via:
  //   - https://wordpress.com/pricing/ (fetched directly)
  //     (confirms Free $0, Personal $9/mo, Premium $18/mo, Business $40/mo,
  //      Commerce $70/mo — all annual billing)
  // Note: this entry covers WordPress.com hosted only, not self-hosted
  // WordPress.org, which is a different product category.
  // ---------------------------------------------------------------------------
  {
    id: "wordpress-com",
    name: "WordPress.com",
    slug: "wordpress-com",
    websiteUrl: "https://wordpress.com",
    bestFor:
      "Content creators, bloggers, and small businesses who want managed WordPress hosting with no server administration.",
    pricingTiers: [
      {
        name: "Free",
        monthlyPrice: "$0/mo",
        summary: "1 GB storage on a WordPress.com subdomain; no custom domain or plugins.",
      },
      {
        name: "Personal",
        monthlyPrice: "$9/mo",
        summary:
          "Custom domain (free first year), 6 GB storage, plugin installation, and ad removal.",
      },
      {
        name: "Premium",
        monthlyPrice: "$18/mo",
        summary:
          "13 GB storage, advanced design tools, VideoPress, and live chat support. Most popular tier.",
      },
      {
        name: "Business",
        monthlyPrice: "$40/mo",
        summary:
          "50 GB storage, SEO tools, SFTP access, install any plugin, and premium theme access.",
      },
      {
        name: "Commerce",
        monthlyPrice: "$70/mo",
        summary:
          "Full WooCommerce integration, advanced ecommerce tools, and premium shipping integrations.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Theme-based setup with a block editor; no AI site generation",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Free for the first year on Personal and above; free plan uses .wordpress.com subdomain",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "World-class blogging platform -- WordPress powers 43% of the web",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "WooCommerce on Commerce plan; full store with plugins on Business+",
        notes: "WordPress.com's ecosystem advantage is unmatched for plugin-based extensibility.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "Jetpack AI available on paid plans for content assistance",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; free plan uses .wordpress.com subdomain",
      },
    ],
    prosCons: {
      pros: [
        "The most mature blogging and content platform on the web -- deep editorial tools.",
        "Plugin ecosystem (Business plan and above) gives access to thousands of extensions.",
        "Familiar Gutenberg block editor and a massive community of themes and resources.",
      ],
      cons: [
        "No AI-guided site generation; starting from scratch requires picking a theme and building manually.",
        "Plugins and advanced customization require Business plan ($40/mo) or above.",
        "More setup and maintenance overhead than AI-first builders for non-technical users.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Carrd
  // Pricing verified 2026-04-21 via:
  //   - https://carrd.co/pro (cross-checked with)
  //   - https://onepagelove.com/carrd-pricing
  //   - https://checkthat.ai/brands/carrd/pricing
  // Carrd bills annually (per year), converted to annual cost below.
  // ---------------------------------------------------------------------------
  {
    id: "carrd",
    name: "Carrd",
    slug: "carrd",
    websiteUrl: "https://carrd.co",
    bestFor:
      "Individuals and creators who need a clean, fast single-page site (portfolio, link-in-bio, personal profile) at a very low cost.",
    pricingTiers: [
      {
        name: "Free",
        monthlyPrice: "$0",
        summary: "Up to 3 free sites on carrd.co subdomains; core features with Carrd branding.",
      },
      {
        name: "Pro Lite",
        monthlyPrice: "$9/yr",
        summary:
          "Up to 3 sites, remove Carrd branding, premium templates, video slideshows; no custom domain.",
      },
      {
        name: "Pro Standard",
        monthlyPrice: "$19/yr",
        summary: "Up to 10 sites with custom domain support and SSL.",
      },
      {
        name: "Pro Plus",
        monthlyPrice: "$49/yr",
        summary:
          "Up to 25 sites each with custom domains, form submissions, embeds, and Stripe integrations.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Template-based single-page builder; choose a layout and fill in content",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Pro Standard ($19/yr) or above required for custom domains",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "No blog functionality; Carrd is single-page only",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Stripe payment embeds on Pro Plus; not a full ecommerce platform",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "No AI generation or writing assistant",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; free plan uses carrd.co subdomain",
      },
    ],
    prosCons: {
      pros: [
        "Extremely affordable -- Pro Standard with custom domain costs just $19 per year.",
        "Fast, lightweight sites that load instantly and look great on mobile.",
        "Perfect for link-in-bio pages, personal profiles, and simple portfolio sites.",
      ],
      cons: [
        "Single-page only; no multi-page sites, blog, or content management.",
        "No AI generation -- users build from templates manually.",
        "Very limited for service businesses that need multiple pages, a blog, or bookings.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Jimdo
  // Pricing verified 2026-04-21 via:
  //   - https://www.jimdo.com/pricing/website/ (cross-checked with)
  //   - https://www.tooltester.com/en/reviews/jimdo-review/jimdo-pricing/
  //   - https://www.websiteplanet.com/blog/jimdo-pricing-plan-best/
  // Website (Dolphin AI) plan prices used; Creator plans excluded.
  // Prices are in USD for annual billing.
  // ---------------------------------------------------------------------------
  {
    id: "jimdo",
    name: "Jimdo",
    slug: "jimdo",
    websiteUrl: "https://www.jimdo.com",
    bestFor:
      "Micro-businesses and local service providers who want a simple, affordable AI-generated website with minimal setup.",
    pricingTiers: [
      {
        name: "Play",
        monthlyPrice: "$0/mo",
        summary: "Free plan on a Jimdo subdomain; 5 pages max and 500 MB storage.",
      },
      {
        name: "Start",
        monthlyPrice: "$11/mo",
        summary: "Custom domain, 5 GB storage, 10 pages, and basic SEO tools.",
      },
      {
        name: "Grow",
        monthlyPrice: "$17/mo",
        summary: "15 GB storage, 50 pages, visitor statistics, and faster support.",
      },
      {
        name: "Unlimited",
        monthlyPrice: "$45/mo",
        summary: "Unlimited storage and pages with premium support.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Jimdo Dolphin uses AI to generate a site from a few guided questions",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Free for the first year on Start plan and above; free plan uses subdomain",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Basic blog included on paid plans",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Separate online store plans starting at $18/mo",
        notes: "Jimdo's store plans are separate from website plans.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "AI site generation at onboarding (Dolphin builder); no ongoing AI writing",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; free Play plan uses Jimdo subdomain",
      },
    ],
    prosCons: {
      pros: [
        "Jimdo Dolphin AI generates a website quickly from a few onboarding questions.",
        "Affordable entry-level paid plan with a custom domain at $11/mo.",
        "Straightforward editor well-suited to non-technical small business owners.",
      ],
      cons: [
        "Limited design flexibility compared to Wix or Squarespace.",
        "Free plan page cap (5 pages) and subdomain-only limit its usefulness.",
        "Platform has not kept pace with competitors on AI features and template quality.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // IONOS Website Builder
  // Pricing verified 2026-04-21 via:
  //   - https://www.ionos.com/websites/website-builder (cross-checked with)
  //   - https://www.expertmarket.com/website-builders/ionos-pricing
  //   - https://allaboutcookies.org/ionos-pricing-guide
  // Regular/renewal annual-billed rates used (not introductory $1/mo offers).
  // MyWebsite Now plans used (not WordPress or ecommerce variants).
  // ---------------------------------------------------------------------------
  {
    id: "ionos",
    name: "IONOS Website Builder",
    slug: "ionos",
    websiteUrl: "https://www.ionos.com/websites/website-builder",
    bestFor:
      "Small businesses in Europe and North America looking for a straightforward, no-frills website builder with bundled hosting and email.",
    pricingTiers: [
      {
        name: "Starter",
        monthlyPrice: "$12/mo",
        summary:
          "Custom domain, SSL, email inbox, and a clean drag-and-drop builder for simple sites.",
      },
      {
        name: "Plus",
        monthlyPrice: "$18/mo",
        summary: "More design options, SEO tools, and additional email inboxes.",
      },
      {
        name: "Pro",
        monthlyPrice: "$30/mo",
        summary:
          "Analytics, heat maps, A/B testing, and premium customer support for growing businesses.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "AI-assisted website generator plus manual drag-and-drop editor",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Included on all paid plans; no meaningful free plan",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Basic blog module available on paid plans",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "Online store add-on available; separate store plans offered",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "AI website generator at setup; limited AI writing tools",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; introductory $1/mo offer is promotional, not a free plan",
      },
    ],
    prosCons: {
      pros: [
        "Bundled domain, SSL, and professional email inbox on every paid plan.",
        "Pro plan includes A/B testing and heat maps -- rarely found at this price point.",
        "Strong infrastructure in Europe; good choice for EU-based small businesses.",
      ],
      cons: [
        "No genuine free plan; $1/mo introductory price reverts to full rate at renewal.",
        "Editor is functional but less intuitive and feature-rich than Wix or Squarespace.",
        "Limited template selection compared to leading builders.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // 10Web
  // Pricing verified 2026-04-21 via:
  //   - https://10web.io/pricing-platform/ (cross-checked with)
  //   - https://max-productive.ai/ai-tools/10web/
  //   - https://www.capterra.com/p/186678/10Web/pricing/
  // Business (single-site) plan prices used at annual billing.
  // ---------------------------------------------------------------------------
  {
    id: "10web",
    name: "10Web",
    slug: "10web",
    websiteUrl: "https://10web.io",
    bestFor:
      "WordPress users and agencies who want AI-generated WordPress sites with managed hosting, automated optimization, and 90+ PageSpeed scores.",
    pricingTiers: [
      {
        name: "AI Starter",
        monthlyPrice: "$10/mo",
        summary:
          "1 WordPress site, AI builder, managed hosting, automated PageSpeed optimization, and free SSL.",
      },
      {
        name: "AI Premium",
        monthlyPrice: "$15/mo",
        summary: "More storage, bandwidth, and advanced AI features for growing sites.",
      },
      {
        name: "AI Ultimate",
        monthlyPrice: "$23/mo",
        summary: "Maximum resources for high-traffic single sites with priority support.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "AI generates a WordPress site from a business description",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Included on all paid plans; 7-day free trial, no permanent free plan",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "Full WordPress blog with all plugins and themes available",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "WooCommerce via WordPress plugin; separate ecommerce plans available",
        notes: "10Web's WordPress output means full WooCommerce capability.",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "AI website builder plus AI content assistant within WordPress",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; 7-day free trial only",
      },
    ],
    prosCons: {
      pros: [
        "Generates a fully functional WordPress site -- you own portable, standard CMS output.",
        "Automated 90+ PageSpeed optimization included at every plan tier.",
        "Full WordPress plugin ecosystem available for any extension needed.",
      ],
      cons: [
        "Outputs WordPress -- brings its complexity and ongoing plugin/theme maintenance.",
        "No permanent free plan; 7-day trial only.",
        "Agency and multi-site management costs scale up quickly.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
  // ---------------------------------------------------------------------------
  // Google Sites
  // Verified 2026-04-21 via:
  //   - https://workspace.google.com/products/sites/
  //   - https://www.neo.space/blog/google-website-builder
  // Google Sites is free for personal Google accounts; Google Workspace
  // (starting at $6/user/mo) is required for business use with custom domains
  // via Google's admin infrastructure.
  // ---------------------------------------------------------------------------
  {
    id: "sites-google",
    name: "Google Sites",
    slug: "sites-google",
    websiteUrl: "https://sites.google.com",
    bestFor:
      "Teams and organizations already in Google Workspace who need a simple internal or external site with zero additional cost.",
    pricingTiers: [
      {
        name: "Free (Google Account)",
        monthlyPrice: "$0/mo",
        summary:
          "Fully free for personal Google accounts; publish on a sites.google.com subdomain with no custom domain support natively.",
      },
      {
        name: "Google Workspace",
        monthlyPrice: "From $6/user/mo",
        summary:
          "Included in Workspace subscriptions; enables organizational publishing, access controls, and Google admin integration.",
      },
    ],
    featureMatrixRow: [
      {
        feature: "Setup style",
        blogbat: "AI-guided onboarding from a single prompt",
        competitor: "Drag-and-drop grid builder; embed Google Docs, Sheets, Calendar natively",
      },
      {
        feature: "Custom domain",
        blogbat: "Included on the free plan",
        competitor: "Not natively supported; custom domains require DNS workarounds or Workspace admin",
      },
      {
        feature: "Blog / content platform",
        blogbat: "Blog available when enabled in deployment, with AI drafting",
        competitor: "No blog functionality; static informational pages only",
      },
      {
        feature: "Ecommerce",
        blogbat: "Simple storefront for small catalogs",
        competitor: "No ecommerce support",
      },
      {
        feature: "AI writing assistant",
        blogbat: "AI at onboarding, section creation, and blog drafting",
        competitor: "No AI generation for sites; Google Workspace AI (Gemini) available separately",
      },
      {
        feature: "Free tier with custom domain",
        blogbat: "Yes",
        competitor: "No; custom domains require non-trivial DNS setup or Workspace subscription",
      },
    ],
    prosCons: {
      pros: [
        "Completely free for personal Google accounts -- zero cost for a basic informational site.",
        "Seamless embedding of Google Docs, Sheets, Slides, Maps, and Calendar.",
        "Real-time collaborative editing just like Google Docs.",
      ],
      cons: [
        "No AI site generation; no blog; no ecommerce; no contact forms natively.",
        "Minimal design control -- limited templates and no custom CSS.",
        "Not suitable as a public business website for most use cases.",
      ],
    },
    verifiedAt: "2026-04-21",
  },
];

/** Fast lookup by slug for route handlers. */
export function getCompetitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((competitor) => competitor.slug === slug);
}

/** All slugs used by `generateStaticParams` on the dynamic routes. */
export function getCompetitorSlugs(): string[] {
  return COMPETITORS.map((competitor) => competitor.slug);
}
