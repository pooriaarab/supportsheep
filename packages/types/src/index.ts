/**
 * Shared Type Definitions
 *
 * Generic types used across the monorepo. Import from "@repo/types".
 */

/* -------------------------------------------------------------------------- */
/* User                                                                        */
/* -------------------------------------------------------------------------- */

export type UserRole =
  | "owner"
  | "admin"
  | "editor"
  | "author"
  | "guest"
  | "member"
  | "viewer";

export type UserStatus = "active" | "invited" | "suspended" | "deactivated";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Item (generic CRUD entity)                                                  */
/* -------------------------------------------------------------------------- */

export type ItemStatus =
  | "draft"
  | "active"
  | "in_progress"
  | "completed"
  | "archived";

export type ItemPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface Item {
  id: string;
  title: string;
  description: string | null;
  status: ItemStatus;
  priority: ItemPriority;
  assigneeId: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Audit Log                                                                   */
/* -------------------------------------------------------------------------- */

export type AuditAction =
  | "create_item"
  | "update_item"
  | "delete_item"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "login"
  | "logout"
  | "update_settings"
  | "create_api_key"
  | "revoke_api_key"
  | "connect_integration"
  | "disconnect_integration"
  | string; // Allow custom actions

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  result: "success" | "failure";
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* API Key                                                                     */
/* -------------------------------------------------------------------------- */

export type ApiKeyScope = "read" | "write" | "admin";

export interface ApiKey {
  id: string;
  name: string;
  /** Only returned on creation — stored hashed thereafter */
  key?: string;
  /** Prefix for display (e.g., "sk_...abc") */
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdById: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Integration                                                                 */
/* -------------------------------------------------------------------------- */

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending";

export interface Integration {
  id: string;
  provider: string;
  displayName: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Template                                                                    */
/* -------------------------------------------------------------------------- */

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: Record<string, unknown>;
  isPublic: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export interface Settings {
  /** Application-level settings (name, logo, etc.) */
  app: {
    name: string;
    description: string;
    logoUrl: string | null;
    favicon: string | null;
    primaryColor: string;
  };
  /** Feature flags */
  features: Record<string, boolean>;
  /** Notification preferences */
  notifications: {
    email: boolean;
    push: boolean;
    slack: boolean;
  };
  /** Security settings */
  security: {
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    allowedDomains: string[];
  };
}

/* -------------------------------------------------------------------------- */
/* API Response Generics                                                       */
/* -------------------------------------------------------------------------- */

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
  correlationId?: string;
}

export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Blog-Specific Types                                                         */
/* -------------------------------------------------------------------------- */

export const POST_TYPES = [
  "blog_post",
  "listicle",
  "how_to",
  "comparison",
  "product_review",
  "pillar_page",
  "glossary",
  "landing_page",
] as const;
export type PostType = (typeof POST_TYPES)[number];

export const ARTICLE_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "scheduled",
  "archived",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const PERMALINK_PATTERNS = [
  "/<slug>/",
  "/<category>/<slug>/",
  "/blog/<slug>/",
  "/blog/<category>/<slug>/",
] as const;
export type PermalinkPattern = (typeof PERMALINK_PATTERNS)[number];

export interface PermalinkSettings {
  canonicalPattern: PermalinkPattern;
  redirectOldPatterns: boolean;
  allowedPatterns: PermalinkPattern[];
}

export interface ArticleVersion {
  body: string;
  savedAt: string;
  note: string;
}

export interface GenerationMeta {
  keyword: string;
  contextTagId: string;
  provider: string;
  model: string;
  postTypeTemplate: string;
  skillsPipelineRun: string[];
}

/**
 * Featured image on an article. Object shape with URL, alt text, and optional
 * intrinsic dimensions.
 */
export interface FeaturedImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Article {
  blogId: string;
  title: string;
  slug: string;
  canonicalPath?: string;
  legacyPaths?: string[];
  sourceUrl?: string | null;
  sourcePath?: string | null;
  wordpressPostId?: string | null;
  body: string;
  draftBody: string;
  excerpt: string;
  /**
   * Optional 40-80 word direct answer rendered as a TL;DR callout above the
   * featured image and surfaced to voice assistants via the
   * Speakable schema. Empty string when unset.
   */
  summary: string;
  status: ArticleStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  postType: PostType;
  /**
   * Legacy single-category field. Kept on the document for backward
   * compatibility with reads; new writes should populate `primaryCategory`
   * and `categories[]`. Read helpers fall back to this when the new fields
   * are absent.
   */
  category: string;
  /**
   * Primary category slug for the article. Drives canonical category page
   * membership, breadcrumbs, and the default category chip on cards.
   */
  primaryCategory?: string;
  /**
   * Full list of category slugs the article belongs to (primary first).
   * Used by the public related-articles and taxonomy logic.
   */
  categories?: string[];
  tags: string[];
  /**
   * Display name of the article author. Kept for back-compat with imported
   * documents. When {@link Article.authorId} is set, it takes precedence.
   */
  author: string;
  /**
   * References a document in the `authors` collection (`authors/{authorId}`).
   * Prefer this over the bare {@link Article.author} string.
   */
  authorId?: string;
  featuredImage: FeaturedImage;
  ogImage: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  seoScore: number;
  internalLinks: { anchor: string; url: string }[];
  externalLinks: { anchor: string; url: string }[];
  versions: ArticleVersion[];
  generatedBy: "manual" | "keyword" | "bulk" | "content_plan" | "interview" | null;
  guestAttribution?: {
    name?: string;
    email?: string;
  } | null;
  generationMeta: GenerationMeta | null;
  source?: {
    kind: "webhook";
    integrationId: string;
    provider: string;
    externalArticleId: string | null;
    receivedAt: string;
  };
  submissionStatus?: {
    indexNow?: {
      status: "not_configured" | "pending" | "submitted" | "failed";
      lastSubmittedAt: string | null;
      lastUrl: string | null;
      lastError: string | null;
    };
  };
  wordCount: number;
  readingTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryEntry {
  displayName: string;
  order: number;
  icon: string;
  description: string;
  postCount: number;
}

export interface CategoryConfig {
  blogId: string;
  order: Record<string, CategoryEntry>;
}

export interface MediaItem {
  id: string;
  blogId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface ContextTag {
  id: string;
  blogId: string;
  name: string;
  targetAudience: string;
  tone: string;
  style: string;
  language: string;
  articleLength: { min: number; max: number };
  cta: { text: string; url: string };
  customPrompt: string;
  imageSettings: {
    style: string;
    colorScheme: string;
    count: number;
    aspectRatio: string;
  };
  createdAt: string;
}

export interface InternalLinkRule {
  id: string;
  blogId: string;
  keyword: string;
  targetUrl: string;
  maxPerArticle: number;
}

export interface SitemapEntry {
  id: string;
  blogId: string;
  url: string;
  urls: string[];
  lastFetched: string;
}

export interface ContentPlanPost {
  keyword: string;
  postType: PostType;
  scheduledDate: string;
  status: "pending" | "generating" | "generated" | "published" | "failed";
  articleSlug: string | null;
  contextTagId: string;
}

export interface ContentPlan {
  id: string;
  blogId: string;
  name: string;
  status: "active" | "paused" | "completed";
  posts: ContentPlanPost[];
  createdAt: string;
}

export interface WritingSkill {
  id: string;
  blogId: string;
  name: string;
  type: "builtin" | "custom";
  description: string;
  prompt: string;
  provider: string;
  model: string;
  order: number;
  enabled: boolean;
}

/* -------------------------------------------------------------------------- */
/* Free Tools                                                                 */
/* -------------------------------------------------------------------------- */

export type FreeToolExecutionMode = "deterministic" | "ai";

export type FreeToolCategory =
  | "seo"
  | "writing"
  | "social"
  | "schema"
  | "utility"
  | "business"
  | "aeo_geo";

export interface FreeToolInputField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  maxLength?: number;
}

export interface FreeToolCalloutConfig {
  enabled: boolean;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    term: string;
  };
}

export interface FreeToolSeoConfig {
  indexable: boolean;
  canonicalPath: string;
  includeInToolsIndex: boolean;
  includeInSitemap: boolean;
}

export interface FreeToolFaqItem {
  question: string;
  answer: string;
}

export interface FreeToolCtaConfig {
  label: string;
  url: string;
}

export interface FreeToolAppearanceConfig {
  layout: "compact" | "editorial" | "utility";
  accent: "default" | "blue" | "green" | "purple";
}

export interface FreeToolAiConfig {
  enabled: boolean;
  provider: "claude" | "gpt" | "gemini";
  model: string;
  dailyLimit: number;
  maxInputChars: number;
  maxOutputTokens: number;
}

export interface BlogFreeToolDefaultCalloutConfig {
  enabled: boolean;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryBaseUrl: string;
  secondaryLabel: string;
  secondaryBaseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

export interface BlogFreeToolsConfig {
  indexEnabled: boolean;
  defaultCta: FreeToolCtaConfig;
  defaultCallout: BlogFreeToolDefaultCalloutConfig;
  defaultAiDailyLimit: number;
  defaultNonAiMinuteLimit: number;
}

export interface FreeTool {
  id: string;
  blogId: "default";
  templateId: string;
  source: "predefined";
  enabled: boolean;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  faq: FreeToolFaqItem[];
  cta: FreeToolCtaConfig;
  callout: FreeToolCalloutConfig;
  appearance: FreeToolAppearanceConfig;
  ai: FreeToolAiConfig;
  seo: FreeToolSeoConfig;
  createdAt: string;
  updatedAt: string;
}

export interface FreeToolUsage {
  toolId: string;
  blogId: "default";
  day: string;
  subjectHash: string;
  count: number;
  firstUsedAt: string;
  lastUsedAt: string;
}

export interface PublicTopBannerConfig {
  enabled: boolean;
  message: string;
  backgroundColor: string;
  textColor: string;
  scope: "homepage" | "all";
}

export interface PublicShellSectionConfig {
  logoUrl: string | null;
  text: string;
  backgroundColor: string;
  textColor: string;
}

export interface PublicArticleCardsConfig {
  borderRadiusPreset: "sharp" | "soft" | "round";
  borderRadius: string;
  shadowPreset: "none" | "subtle" | "elevated";
  hoverStyle: "none" | "border" | "lift";
}

export interface PublicArticleReadingLayoutConfig {
  contentWidthPreset: "narrow" | "standard" | "wide";
  contentWidth: string;
  bodyLineHeightPreset: "compact" | "balanced" | "airy";
  bodyLineHeight: string;
  summaryBoxStyle: "minimal" | "outlined" | "filled";
}

export interface PublicArticleTableOfContentsConfig {
  enabled: boolean;
  stylePreset: "minimal" | "card" | "bordered";
}

export interface PublicArticleTypographyConfig {
  fontPreset: "default" | "editorial" | "modern";
  headingScalePreset: "compact" | "balanced" | "display";
}

export interface PublicArticleAppearanceConfig {
  cards: PublicArticleCardsConfig;
  readingLayout: PublicArticleReadingLayoutConfig;
  tableOfContents: PublicArticleTableOfContentsConfig;
  typography: PublicArticleTypographyConfig;
}

export type InterviewStyle =
  | "testimonial"
  | "eeat"
  | "case_study"
  | "qa"
  | "launch"
  | "smart";

export type InterviewLanguage =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "ja"
  | "ko"
  | "zh";

export interface BlogConfig {
  blogId: string;
  siteName: string;
  siteDescription: string;
  logo: string;
  permalinks?: PermalinkSettings;
  publicAppearance?: {
    themeMode: "light" | "dark";
    topBanner?: PublicTopBannerConfig;
    header?: PublicShellSectionConfig;
    footer?: PublicShellSectionConfig;
    article?: PublicArticleAppearanceConfig;
  };
  homepage: {
    layout: "grid" | "sidebar" | "hybrid";
    postsPerPage: number;
    featuredCategory: string | null;
  };
  seo: {
    defaultMetaTitle: string;
    defaultMetaDescription: string;
    googleAnalyticsId: string;
    clarityId: string;
    submissionProtocols?: {
      indexNow?: {
        enabled: boolean;
        apiKey: string;
      };
    };
  };
  ai: {
    defaultProvider: "claude" | "gpt" | "gemini";
    providers: {
      claude: { apiKey: string; model: string };
      gpt: { apiKey: string; model: string };
      gemini: { apiKey: string; model: string };
      tavus?: {
        apiKey: string;
        defaultAvatarId: string;
        defaultPersonaId?: string;
      };
    };
    defaultContextTagId: string;
    defaultSkillsPipeline: string[];
  };
  analytics?: {
    /**
     * the knowledge base owner's own GA4 Measurement ID (format `G-XXXXXXXXXX`). When set
     * to a valid value, the standard gtag.js client tag is injected on this
     * blog's public tenant pages so the owner's Google Analytics tracks their
     * blog's pageviews. Empty/undefined disables the tag. This is a purely
     * client-side measurement tag — no Google API credentials are involved.
     */
    gaMeasurementId?: string;
  };
  freeTools?: BlogFreeToolsConfig;
  interview?: {
    defaultStyle: InterviewStyle;
    defaultDurationSec: number;
    defaultRecording: "transcript" | "audio" | "video";
    whoCanMintLinks: ("owner" | "admin" | "editor")[];
    monthlyCostCapUsd: number | null;
    retention: {
      audioDays: number;
      transcriptDays: number;
    };
    defaultLanguage: InterviewLanguage;
  };
  publishing: {
    defaultStatus: "draft" | "published";
    autoSchedule: boolean;
  };
  images?: {
    unsplash?: { apiKey: string };
    pexels?: { apiKey: string };
  };
  support?: {
    enableVoice: boolean;
    enableChatbot: boolean;
    systemPrompt?: string;
    greeting?: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Pillar Pages                                                                */
/* -------------------------------------------------------------------------- */

export interface PillarCluster {
  title: string;
  description?: string;
  articleSlugs: string[];
}

export interface Pillar {
  slug: string;
  title: string;
  summary: string;
  heroEyebrow?: string;
  order: number;
  clusters: PillarCluster[];
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Competitor (alternatives hub)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pricing tier for a competitor or for Supportsheep itself. Costs are monthly USD
 * expressed as a human-readable string so unusual tiers (free, custom,
 * contact-sales) do not have to be shoehorned into a number.
 */
export interface CompetitorPricingTier {
  name: string;
  monthlyPrice: string;
  summary: string;
}

/**
 * One row of the side-by-side feature matrix rendered on alternatives and
 * head-to-head pages. Values are short text labels so they can describe
 * booleans ("Included"), limits ("10 GB"), or nuance ("Paid add-on").
 */
export interface CompetitorFeatureMatrixRow {
  feature: string;
  supportsheep: string;
  competitor: string;
  notes?: string;
}

export interface CompetitorProsCons {
  pros: string[];
  cons: string[];
}

export interface Competitor {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  websiteUrl: string;
  /** Short "best for" positioning used in the hub list and meta descriptions. */
  bestFor: string;
  pricingTiers: CompetitorPricingTier[];
  featureMatrixRow: CompetitorFeatureMatrixRow[];
  prosCons: CompetitorProsCons;
  /** ISO date string ("YYYY-MM-DD") for the last time claims were checked. */
  verifiedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Authors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A named author. Enables rich `Person` JSON-LD on article pages (the single
 * biggest AI-citation lever per Princeton GEO research) and dedicated author
 * archive pages at `/authors/{slug}`.
 *
 * The document id is the URL slug (matches the pattern used by categories).
 */
export interface Author {
  /** URL-safe slug used as the Firestore document id and public route segment */
  id: string;
  name: string;
  jobTitle?: string;
  bio: string;
  avatarUrl?: string;
  email?: string;
  /**
   * Profile URLs on third-party sites (LinkedIn, X/Twitter, GitHub, personal
   * site, etc.). Emitted as `sameAs` in the Person schema to strengthen entity
   * grounding for AI crawlers and search engines.
   */
  sameAs?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportJob {
  id: string;
  blogId: string;
  source: "wordpress";
  status: "pending" | "running" | "completed" | "failed";
  totalPosts: number;
  importedPosts: number;
  rehostedImages: number;
  failedPosts: { slug: string; error: string }[];
  createdBy: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------------------------------------------------------- */
/* Programmatic Pages (SEO landing pages)                                      */
/* -------------------------------------------------------------------------- */

export const PROGRAMMATIC_COLLECTIONS = [
  "for",
  "alternatives",
  "alternatives_for_vertical",
  "compare",
  "vs",
] as const;
export type ProgrammaticCollection = (typeof PROGRAMMATIC_COLLECTIONS)[number];

export const PROGRAMMATIC_PUBLISH_STATUSES = [
  "draft",
  "published",
  "noindex",
] as const;
export type ProgrammaticPublishStatus =
  (typeof PROGRAMMATIC_PUBLISH_STATUSES)[number];

/**
 * An optional FAQ item attached to a programmatic landing page. Rendered in
 * the public template and emitted as FAQPage JSON-LD.
 */
export interface ProgrammaticFaq {
  question: string;
  answer: string;
}

/**
 * Programmatic SEO landing page record.
 *
 * Stored in Firestore collection `programmatic_pages`, keyed by the `id`
 * field (which equals the URL slug within its `collection`).
 */
export interface ProgrammaticPage {
  /** Doc id and URL slug within its collection (e.g., "plumbers"). */
  id: string;
  /** Collection type -- determines the URL prefix (e.g., "for" => /for/<slug>). */
  collection: ProgrammaticCollection;
  /** Variant key used by generators (e.g., "plumbers", "real-estate-agents"). */
  variantKey: string;
  /** Arbitrary template variables surfaced to the page template. */
  variables: Record<string, string>;
  /** <title> tag + hero headline. */
  title: string;
  /** <meta name="description"> content (<=160 chars recommended). */
  metaDescription: string;
  /** Markdown or sanitized HTML body (min 400 words to be indexable). */
  uniqueContent: string;
  /** Precomputed word count of `uniqueContent`. */
  wordCount: number;
  /** Optional FAQ items rendered on the page and emitted as FAQPage JSON-LD. */
  faqs?: ProgrammaticFaq[];
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Publish state -- `noindex` keeps the URL live but blocks indexing. */
  publishStatus: ProgrammaticPublishStatus;
}
