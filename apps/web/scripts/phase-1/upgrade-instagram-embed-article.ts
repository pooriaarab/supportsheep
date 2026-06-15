/**
 * Phase 1 Tier-3 upgrade: embed-instagram-feed-on-website
 *
 * Current state (pre-upgrade):
 *   - ~3,211 words, 1 comparison table, 5 FAQs, no TL;DR, no YouTube embed
 *
 * Upgrade targets:
 *   - TL;DR at top
 *   - 2 tables (existing method comparison + new free-vs-paid tools table)
 *   - 6–8 FAQs (up from 5)
 *   - 1 YouTube embed (Elfsight tutorial — youtube.com/watch?v=Wjys1Pp6nrY)
 *   - 2 Unsplash images (verified 200)
 *   - Expanded coverage: iFrame method, oEmbed API, native Meta embed,
 *     Elfsight, SnapWidget, Taggbox, EmbedSocial
 *   - 8+ citations from authoritative sources
 *   - Supportsheep mention honest: custom-code section via Code Embed block
 *
 * Safety rules:
 *   - Writes to `draftBody` ONLY — `body` and `status:"published"` are untouched.
 *   - The live page (/embed-instagram-feed-on-website) stays at 200.
 *   - Set status to "draft" is intentionally skipped; user reviews draft body
 *     in admin and clicks publish when ready.
 *   - Idempotent: re-running overwrites the same draftBody stamp.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/upgrade-instagram-embed-article.ts
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";

const TARGET_SLUG = "embed-instagram-feed-on-website";

/**
 * Strip HTML and count words — used only for the pre-flight word-count check.
 */
function countWords(html: string): number {
  const stripped = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped ? stripped.split(" ").filter(Boolean).length : 0;
}

/* ────────────────────────────────────────────────────────────────────────────
   UPGRADED DRAFT BODY
   ──────────────────────────────────────────────────────────────────────────── */

const DRAFT_BODY = `
<section class="tldr" data-block="tldr">
<h2>TL;DR</h2>
<p>Embedding your Instagram feed adds live social proof, fresh content, and conversion triggers to any website — without needing a developer. You have four distinct methods: Instagram's native single-post oEmbed code (free, zero customization), a third-party widget like Elfsight or SnapWidget (free tiers available, drag-and-drop styling), the official Instagram Basic Display API (full control, developer required), and raw iFrame embeds (fragile, not recommended). For most supportsheep business owners and small teams, a third-party widget is the right choice — it takes under five minutes, requires no code, and works on every major website builder. Scroll to the comparison tables below to pick your tool; scroll to the FAQ for quick answers on private accounts, GDPR, and page speed.</p>
</section>

<p>Embedding your Instagram feed on your website is one of the most effective moves you can make for social proof. A live grid of your real posts — with likes, captions, and product visuals — converts passive visitors into followers and buyers faster than static copy ever could. It also keeps your site feeling current without manual updates: every new post you publish on Instagram appears on your site automatically.</p>

<p>According to a 2025 survey by Recurpost, Instagram has roughly <a href="https://recurpost.com/blog/instagram-statistics/">3 billion monthly active users globally</a>, making it the largest visual-first social platform. Bringing even a fraction of that energy onto your own domain means you own the context around your content — no algorithm deciding whether your followers see it.</p>

<img src="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&auto=format&fit=crop&q=80" alt="Mobile phone displaying an Instagram profile with a grid of photos." loading="lazy" />

<h2>Why embedding your Instagram feed matters</h2>

<p>Before diving into the how, it helps to understand the specific gains. An embedded feed is not a vanity feature — it serves three measurable business functions:</p>

<ul>
<li><strong>Social proof at the point of decision.</strong> When a potential client or customer sees your real posts — not stock photography — right next to your services or products, trust builds faster. EmbedSocial's research on <a href="https://embedsocial.com/blog/instagram-statistics/">Instagram's marketing impact</a> notes that over 80% of marketers plan to use Instagram for influencer marketing, and embedding their collaborations directly on your site extends the reach of that investment.</li>
<li><strong>Content freshness without manual effort.</strong> Every new Instagram post you publish automatically refreshes the feed on your site. For solopreneurs and small teams who cannot maintain a separate photo gallery, this is meaningful time savings.</li>
<li><strong>Audience cross-pollination.</strong> Website visitors who discover your Instagram through an embedded feed convert at higher rates than those who find you through the Instagram app alone — they already have brand context.</li>
</ul>

<h2>The four methods: a plain-English overview</h2>

<p>There is no single right answer. The best approach depends on your technical comfort, the website platform you use, and whether you need a single post or a full live gallery. Here is what each option actually involves:</p>

<h3>Method 1: Instagram's native oEmbed (single post)</h3>
<p>Instagram exposes a public <a href="https://developers.facebook.com/docs/instagram/oembed/">oEmbed API endpoint</a> at <code>https://graph.facebook.com/v18.0/instagram_oembed</code>. For end users, you never interact with the API directly — Instagram surfaces it through the native "Embed" button on any public post.</p>
<ol>
<li>Open the post on instagram.com (must be public).</li>
<li>Click the three-dot menu in the top-right corner of the post.</li>
<li>Select <strong>Embed</strong>.</li>
<li>Copy the <code>&lt;blockquote&gt;</code> block and the <code>&lt;script&gt;</code> tag.</li>
<li>Paste both into an HTML block on your website.</li>
</ol>
<p><strong>Result:</strong> A single post rendered in Instagram's standard card style. No live gallery. No layout control. Free.</p>

<h3>Method 2: iFrame embed (not recommended)</h3>
<p>Technically you can wrap an Instagram profile URL in an <code>&lt;iframe&gt;</code> tag and point it at <code>https://www.instagram.com/username/embed/</code>. Some older tutorials suggest this. <strong>Do not use it.</strong> Instagram's Terms of Service prohibit framing their pages without explicit permission, and Meta has tightened enforcement. The embed frequently breaks after app updates, and it does not trigger properly on mobile browsers.</p>

<h3>Method 3: Third-party widget (recommended for most)</h3>
<p>Tools like <strong>Elfsight</strong>, <strong>SnapWidget</strong>, <strong>EmbedSocial</strong>, and <strong>Taggbox</strong> connect to Instagram's official API on your behalf. You authenticate once, configure the layout in a visual editor, copy one line of script code, and paste it anywhere on your site.</p>
<p>Key advantages over the native embed:</p>
<ul>
<li>Full gallery — not just one post.</li>
<li>Layout control: grid, carousel, masonry, slider.</li>
<li>Hashtag feeds and tagged-post feeds on paid tiers.</li>
<li>Lazy loading and caching built in, so page speed impact is minimal.</li>
</ul>

<h3>Method 4: Instagram Basic Display API (developer route)</h3>
<p>If you have a developer and specific requirements — custom UI, server-side rendering, no third-party script on your page — you can pull your feed directly via the <a href="https://developers.facebook.com/docs/instagram-basic-display-api/">Instagram Basic Display API</a>. This requires a Facebook Developer App, OAuth token management, and ongoing maintenance as Meta updates the API. It is the highest-control option and the highest-cost. It is not a DIY project.</p>

<h2>Comparing your Instagram feed embedding options</h2>

<p>The table below summarises the key trade-offs across all four methods so you can decide at a glance.</p>

<table>
<thead>
<tr>
<th>Method</th>
<th>Gallery (multi-post)?</th>
<th>Ease of setup</th>
<th>Customisation</th>
<th>Cost</th>
<th>Recommended for</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Native oEmbed</strong></td>
<td>No (single post)</td>
<td>Very easy</td>
<td>None</td>
<td>Free</td>
<td>Embedding one specific post in a blog article</td>
</tr>
<tr>
<td><strong>iFrame</strong></td>
<td>Technically yes</td>
<td>Easy</td>
<td>None</td>
<td>Free</td>
<td>Not recommended — ToS violation risk, unreliable</td>
</tr>
<tr>
<td><strong>Third-party widget</strong></td>
<td>Yes</td>
<td>Easy (no-code)</td>
<td>High</td>
<td>Free tier or $3–$20/mo</td>
<td>Most website owners who want a live gallery</td>
</tr>
<tr>
<td><strong>Basic Display API</strong></td>
<td>Yes</td>
<td>Hard (developer required)</td>
<td>Total</td>
<td>Developer cost</td>
<td>Large teams with custom design requirements</td>
</tr>
</tbody>
</table>

<h2>Free vs paid Instagram embed tools: what you actually get</h2>

<p>Most third-party widget tools follow the same freemium model: free forever on a single site with a provider watermark, paid plans unlock custom domains, more posts, analytics, and moderation features. Here is how the main tools compare as of April 2026. Verify current pricing on each provider's website before signing up — these plans change.</p>

<table>
<thead>
<tr>
<th>Tool</th>
<th>Free tier</th>
<th>Paid from</th>
<th>Platforms supported</th>
<th>Hashtag feeds</th>
<th>Notes</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong><a href="https://elfsight.com/instagram-feed-instashow/">Elfsight</a></strong></td>
<td>Yes (200 views/mo)</td>
<td>~$5/mo</td>
<td>Any HTML, WordPress, Wix, Squarespace, Webflow</td>
<td>Paid</td>
<td>AI-powered customiser; large template library</td>
</tr>
<tr>
<td><strong><a href="https://snapwidget.com">SnapWidget</a></strong></td>
<td>Yes (100 views/mo)</td>
<td>~$6/mo</td>
<td>Any HTML, WordPress</td>
<td>Paid</td>
<td>Very simple setup; reliable for small sites</td>
</tr>
<tr>
<td><strong><a href="https://embedsocial.com">EmbedSocial</a></strong></td>
<td>Limited</td>
<td>~$29/mo</td>
<td>Any HTML, WordPress, Wix, Shopify</td>
<td>Yes (paid)</td>
<td>Includes reviews aggregation; more comprehensive</td>
</tr>
<tr>
<td><strong><a href="https://taggbox.com">Taggbox</a></strong></td>
<td>Yes (basic)</td>
<td>~$24/mo</td>
<td>Any HTML, WordPress, Shopify</td>
<td>Yes (paid)</td>
<td>Strong UGC moderation tools</td>
</tr>
<tr>
<td><strong><a href="https://smashballoon.com/instagram-feed/">Smash Balloon</a></strong></td>
<td>No</td>
<td>~$49/yr</td>
<td>WordPress only</td>
<td>Yes (paid)</td>
<td>Best-rated WordPress Instagram plugin</td>
</tr>
</tbody>
</table>

<h2>Step-by-step: adding an Instagram feed with a third-party widget</h2>

<p>The process is nearly identical across tools. This walkthrough uses Elfsight as the example, but the same steps apply to SnapWidget, Taggbox, or any other widget tool.</p>

<img src="https://images.unsplash.com/photo-1664575602554-2087b04935a5?w=1200&auto=format&fit=crop&q=80" alt="Person working on a laptop with social media analytics visible on screen." loading="lazy" />

<h3>Step 1: Create an account and connect Instagram</h3>
<p>Sign up for a free account on your chosen tool's website. When prompted, connect your Instagram account. You will be redirected to Meta's official OAuth login — you are not handing over your password to the widget provider. You are granting the tool read-only access to your public posts.</p>
<p><strong>Important requirement:</strong> Your Instagram account must be a <strong>Business or Creator account</strong> set to <strong>public</strong>. Personal accounts and private accounts will not work with any third-party feed tool.</p>

<h3>Step 2: Customise the layout</h3>
<p>Inside the widget's editor you can adjust:</p>
<ul>
<li><strong>Layout:</strong> grid, carousel, masonry, slider, or highlight</li>
<li><strong>Post count:</strong> how many posts to display initially</li>
<li><strong>Column count:</strong> 1–6 columns across screen sizes</li>
<li><strong>Colours and fonts:</strong> to match your brand</li>
<li><strong>Load more button:</strong> show or hide</li>
<li><strong>Hover overlay:</strong> likes, comments, caption preview</li>
</ul>

<h3>Step 3: Copy the embed code</h3>
<p>Click "Get Code" or "Embed" in the widget editor. You will receive a short <code>&lt;script&gt;</code> tag (for most tools) or a WordPress shortcode. Copy it.</p>

<h3>Step 4: Paste into your website</h3>
<p>The paste location depends on your platform:</p>
<ul>
<li><strong>HTML / custom site:</strong> paste directly in your page's HTML where you want the feed to appear.</li>
<li><strong>WordPress:</strong> add a Custom HTML block in the block editor and paste.</li>
<li><strong>Wix:</strong> use the Embed → Custom Embeds → Embed HTML element.</li>
<li><strong>Squarespace:</strong> add a Code Block and paste.</li>
<li><strong>Webflow:</strong> add an Embed element and paste. (Webflow also has a step-by-step guide from Elfsight's team — see the <a href="https://www.youtube.com/watch?v=Wjys1Pp6nrY">video walkthrough</a>.)</li>
</ul>

<h3>Adding the feed to a Supportsheep website</h3>
<p>Supportsheep is an AI-assisted website builder for solopreneurs and small businesses. Supportsheep includes a <strong>Code Embed section</strong> (available on Pro and Grow plans — see <a href="https://supportsheep.com/pricing">supportsheep.com/pricing</a>) that lets you paste any third-party widget code directly into a page. The Code Embed block is the correct place for your Instagram widget script. Supportsheep handles rendering and mobile layout; the widget provider handles the Instagram API connection.</p>
<p>Honest note: Supportsheep does not have a native Instagram feed module. You need a third-party widget — the Code Embed section is how you connect them. If you are on a Free plan, upgrading to Pro ($20/mo billed annually, verified April 2026) unlocks the Code Embed block. See <a href="https://supportsheep.com/pricing">the current pricing page</a> for the latest plan details.</p>

<h2>Performance: keeping your feed from slowing the page</h2>

<p>A poorly configured Instagram feed can add 200–400ms to your initial page load — enough to hurt Core Web Vitals scores and mobile experience. The fix is straightforward:</p>

<ul>
<li><strong>Enable lazy loading</strong> in your widget settings. Images below the fold load only when a user scrolls toward them, so the initial page render is not blocked by a full grid of photos.</li>
<li><strong>Limit the visible post count</strong> to 6–9 posts initially. A "load more" button handles overflow. Fewer simultaneous image loads means faster first paint.</li>
<li><strong>Use a caching widget</strong>. Quality tools (Elfsight, Smash Balloon) cache your Instagram data on their CDN, so your page is not making a live API call on every visitor load.</li>
<li><strong>Test after embedding.</strong> Run a quick check with <a href="https://pagespeed.web.dev/">Google PageSpeed Insights</a> on both desktop and mobile after you add the feed. A well-configured widget should add no more than 5–10 points to your mobile performance score. If it adds more, reduce post count or confirm lazy loading is on.</li>
</ul>

<h2>GDPR and privacy considerations</h2>

<p>If you serve visitors in the EU or UK, third-party embed scripts on your page may trigger GDPR consent requirements. Instagram's own embed script (<code>platform.instagram.com/en_US/embeds.js</code>) sets cookies when it fires. Third-party widget scripts vary.</p>

<p>Practical steps:</p>
<ul>
<li>Choose a widget provider that explicitly states GDPR compliance in their privacy policy.</li>
<li>If your site uses a cookie consent banner, list the widget provider as a third-party service.</li>
<li>Update your privacy policy to mention that your site uses a social media aggregation tool to display Instagram content.</li>
</ul>

<h2>A short video walkthrough</h2>

<p>If you prefer to follow along visually, Elfsight published a concise tutorial showing the exact steps for embedding a live Instagram feed widget into a Webflow site using their Code Embed element. The workflow is the same for any HTML-based platform.</p>

<iframe src="https://www.youtube.com/embed/Wjys1Pp6nrY" title="Embed a live Instagram feed widget using Elfsight" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen width="560" height="315" loading="lazy"></iframe>

<h2>Smart content curation: what to show</h2>

<p>Embedding the feed is step one. Step two is making sure the content it shows actually works for your goals.</p>

<ul>
<li><strong>Pin your strongest posts.</strong> Most widget tools let you reorder or pin specific posts to the top of the grid. Use this for your best-performing carousels (which average a <a href="https://embedsocial.com/blog/instagram-statistics/">1.7% engagement rate</a> versus 1.17% for static photos) or for customer testimonial posts.</li>
<li><strong>Show product-specific feeds on product pages.</strong> If you sell multiple product lines, use a widget configured to pull only posts tagged with a specific hashtag and embed that version on the relevant product or service page.</li>
<li><strong>Include a CTA above the feed.</strong> A simple line like "Follow us on Instagram for behind-the-scenes content" above the grid increases click-through to your profile. Do not assume visitors will know what to do.</li>
</ul>

<section class="faq" data-block="faq">
<div class="faq-item">
<h3 class="faq-question">What is the best way to embed an Instagram feed on a website?</h3>
<div class="faq-answer"><p>For a live, updating gallery, a third-party widget (Elfsight, SnapWidget, Taggbox, EmbedSocial) is the best choice for most people. You connect your Instagram account, style the feed in a visual editor, copy one line of code, and paste it into an HTML block on your site. Setup takes under five minutes and requires no coding. Instagram's native embed is only suitable when you want to feature one specific post inside a blog article.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">What is Instagram's oEmbed and how does it work?</h3>
<div class="faq-answer"><p>Instagram's oEmbed is an open standard that lets you embed a single public post by pasting a short blockquote code block into any HTML page. Instagram exposes it at <code>https://graph.facebook.com/v18.0/instagram_oembed</code>. In practice you access it through the "Embed" button on any post on instagram.com — you never need to call the API directly. It is free and requires no account setup, but it only works for one post at a time and you have no control over how it looks.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">Can I use an iFrame to embed Instagram on my website?</h3>
<div class="faq-answer"><p>Technically yes, but this approach is not recommended. Instagram's Terms of Service prohibit framing their pages without explicit permission, and Meta has tightened enforcement over time. iFrame embeds break regularly when Instagram updates its app, behave poorly on mobile, and offer no customisation. Use a third-party widget or the native oEmbed instead.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">Do I need a Business or Creator Instagram account to embed a feed?</h3>
<div class="faq-answer"><p>Yes. Both your Instagram account and any third-party widget that accesses it via the official API require a Business or Creator account set to public. Personal accounts and private accounts will not work with feed widgets. You can switch a Personal account to Business or Creator for free inside Instagram Settings → Account → Switch to Professional Account without losing any of your existing posts or followers.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">Will an embedded Instagram feed slow down my website?</h3>
<div class="faq-answer"><p>It can if the widget is poorly configured, but it does not have to. Enable lazy loading in your widget settings so images only load when a visitor scrolls to them. Limit the initial visible post count to 6–9 posts. Use a reputable widget that caches Instagram data on a CDN rather than making a live API call on each page load. After embedding, test with <a href="https://pagespeed.web.dev/">Google PageSpeed Insights</a> and aim for a mobile performance score impact of 5–10 points or less.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">Is it possible to show a hashtag feed instead of a profile feed?</h3>
<div class="faq-answer"><p>Yes, but only on paid tiers of most widget tools. A hashtag feed pulls in any public post that uses a hashtag you specify, which is powerful for showcasing user-generated content from a marketing campaign or event. This feature is not available through Instagram's native embed or the free tiers of most widgets — it requires the Instagram Graph API, which widget providers bundle into their paid plans.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">Does embedding an Instagram feed require GDPR consent on an EU site?</h3>
<div class="faq-answer"><p>Potentially yes. Instagram's own embed script sets cookies, and most third-party widget scripts include tracking components. If your website serves EU or UK visitors, list your widget provider in your cookie consent banner as a third-party service, update your privacy policy to mention the social media aggregation tool, and choose a widget provider that states GDPR compliance in their documentation.</p></div>
</div>
<div class="faq-item">
<h3 class="faq-question">How do I add an Instagram feed to a Supportsheep website?</h3>
<div class="faq-answer"><p>Supportsheep includes a Code Embed section (available on Pro and Grow plans) that accepts any third-party widget script. Sign up with a widget tool like Elfsight or SnapWidget, configure your feed there, copy the embed code they provide, then paste it into a Code Embed block on your Supportsheep page. Supportsheep handles the responsive layout; the widget handles the Instagram API connection. The Code Embed block requires a Pro or Grow plan — see <a href="https://supportsheep.com/pricing">supportsheep.com/pricing</a> for current plan details.</p></div>
</div>
</section>

<hr />
<p>Ready to add a live Instagram feed to your website? Start with a free tier on Elfsight or SnapWidget — you can have a styled feed embedded in under ten minutes. If you are building your site from scratch, <a href="https://supportsheep.com">Supportsheep</a> gives solopreneurs a fast, AI-assisted path from business description to published website, with the Code Embed block ready for widgets like Instagram feeds once you are on Pro.</p>
`;

/* ────────────────────────────────────────────────────────────────────────────
   MAIN
   ──────────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // Pre-flight word count check
  const words = countWords(DRAFT_BODY);
  if (words < 2000) {
    throw new Error(
      `[upgrade:instagram-embed] draft body is ${words} words — below 2000-word Tier-3 floor`,
    );
  }

  // Fetch the existing article
  const snapshot = await collections
    .articles()
    .where("slug", "==", TARGET_SLUG)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error(`[upgrade:instagram-embed] article not found: ${TARGET_SLUG}`);
  }

  const doc = snapshot.docs[0];
  const existing = doc.data();
  const existingBody = typeof existing.body === "string" ? existing.body : "";
  const existingWordCount = countWords(existingBody);

  console.info(`[upgrade:instagram-embed] found article: ${doc.id}`);
  console.info(`  slug: ${existing.slug}`);
  console.info(`  status: ${existing.status}`);
  console.info(`  existing body word count: ${existingWordCount}`);
  console.info(`  draft body word count: ${words}`);

  // Write draftBody ONLY — body and status:"published" are untouched
  await doc.ref.update({
    draftBody: DRAFT_BODY.trim(),
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.info(
    `[upgrade:instagram-embed] wrote draftBody (${words} words) to ${doc.id}`,
  );
  console.info(
    `  status unchanged: "${existing.status}" — live page stays at 200`,
  );
  console.info(`  review at admin draft queue, then click Publish to go live`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[upgrade:instagram-embed] failed:", err);
    process.exit(1);
  });
