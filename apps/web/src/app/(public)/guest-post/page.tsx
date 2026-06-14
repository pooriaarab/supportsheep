import type { Metadata } from "next";
import {
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

const TALLY_FORM_ID = "rj0MPR";
const TALLY_FORM_URL = `https://tally.so/r/${TALLY_FORM_ID}`;
const TALLY_EMBED_URL = `https://tally.so/embed/${TALLY_FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;

export const metadata: Metadata = {
  title: "Submit a guest blog backlink request | Supportsheep",
  description:
    "Share a live article that links to Supportsheep and request review for a relevant backlink from an existing Supportsheep post.",
  alternates: {
    canonical: "/guest-post",
  },
  openGraph: {
    title: "Submit a guest blog backlink request",
    description:
      "Submit a live article URL, the Supportsheep URL you mentioned, and the URL you want Supportsheep to review.",
    type: "website",
    url: "/guest-post",
  },
  twitter: {
    card: "summary",
    title: "Submit a guest blog backlink request",
    description:
      "Share a verified Supportsheep mention and request review for a relevant backlink.",
  },
};

export default function GuestPostSubmissionPage() {
  const siteUrl = resolvePublicSiteUrl();
  const pageUrl = `${siteUrl}/guest-post`;
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: "Submit a guest blog backlink request",
    description:
      "A public submission page for guest blog and backlink requests that already mention Supportsheep.",
    inLanguage: "en-US",
    isPartOf: {
      "@id": `${siteUrl}/#website`,
    },
  };

  return (
    <div className="bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(pageSchema),
        }}
      />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">
            Guest posts and backlinks
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Submit a guest blog backlink request
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            If you have published a live article that links to Supportsheep, send
            us the article URL and the link you want us to review. We
            periodically verify submissions and may contact you about adding a
            relevant link from an existing Supportsheep post.
          </p>
          <a
            href="#guest-post-form"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Submit guest post
          </a>
        </div>

        <div className="mt-10 grid gap-6 border-t border-border pt-8 text-sm leading-6 text-muted-foreground">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              What to include
            </h2>
            <p className="mt-2 max-w-3xl">
              Share the live article where Supportsheep is mentioned, the exact
              Supportsheep post URL you linked to, and the destination URL you want
              us to consider.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              How review works
            </h2>
            <p className="mt-2 max-w-3xl">
              We check that the backlink is live and that your requested URL is
              useful for Supportsheep readers. Submission does not guarantee a link
              placement.
            </p>
          </div>
        </div>

        <section
          id="guest-post-form"
          aria-labelledby="guest-post-form-title"
          className="mt-10 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
        >
          <div className="mb-5">
            <h2
              id="guest-post-form-title"
              className="text-xl font-semibold tracking-normal text-foreground"
            >
              Submit guest post
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use this form after your article is live and includes a link to
              Supportsheep. We review submissions periodically and only add links
              when the requested URL is relevant for readers.
            </p>
          </div>
          <iframe
            title="Supportsheep backlink request"
            src={TALLY_EMBED_URL}
            loading="eager"
            className="min-h-[1480px] w-full rounded-md border-0 bg-card"
          />
          <p className="px-2 pt-3 text-xs leading-5 text-muted-foreground">
            If the embedded form does not load, open the{" "}
            <a
              href={TALLY_FORM_URL}
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Supportsheep backlink request form
            </a>
            .
          </p>
        </section>
      </section>
    </div>
  );
}
