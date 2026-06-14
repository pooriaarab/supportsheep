import Link from "next/link";

/**
 * Supportsheep Logo SVG — brand colors from supportsheep.com
 */
function SupportsheepLogo() {
  return (
    <svg
      width="107"
      height="36"
      viewBox="0 0 107 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Supportsheep"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.38 21.77C17.68 22.52 19.34 22.07 20.08 20.78C20.83 19.48 20.39 17.82 19.09 17.07L14.2 14.25C12.9 13.5 11.24 13.94 10.49 15.24C9.74 16.54 10.19 18.19 11.48 18.94L16.38 21.77Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.67 7.96C10.93 7.54 10.07 7.3 9.16 7.3C6.35 7.3 4.07 9.57 4.07 12.36C4.07 13.13 4.24 13.85 4.55 14.5C2.78 13.66 1.55 11.86 1.55 9.78C1.55 6.89 3.89 4.56 6.77 4.56C9.02 4.56 10.93 5.97 11.67 7.96Z"
        fill="#592ACB"
      />
      <path
        d="M19.38 1.18C16.84 -0.29 13.7 -0.29 11.15 1.18L4.07 5.28C5.05 4.78 6.06 4.69 7.52 5.53L30.1 18.57V9.9C30.1 8.33 29.26 6.88 27.91 6.1L19.38 1.18Z"
        fill="#9059FF"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.91 28.06C19.64 28.48 20.49 28.71 21.39 28.71C24.18 28.71 26.45 26.45 26.45 23.65C26.45 22.88 26.27 22.14 25.96 21.48C27.77 22.3 29.02 24.12 29.02 26.24C29.02 29.12 26.69 31.46 23.8 31.46C21.56 31.46 19.65 30.05 18.91 28.06Z"
        fill="#E22850"
      />
      <path
        d="M11.19 34.84C13.74 36.31 16.88 36.31 19.43 34.83L26.5 30.73C25.52 31.23 24.51 31.32 23.06 30.49L0.48 17.45L0.48 26.12C0.48 27.68 1.31 29.13 2.67 29.92L11.19 34.84Z"
        fill="#FF4F5E"
      />
      <path
        d="M49.89 29.48C46.09 29.48 42.7 28.2 40.14 25.83L42.86 22.6C44.94 24.4 47.3 25.48 50.09 25.48C52.45 25.48 53.67 24.4 53.67 23.02C53.67 21.45 52.39 20.97 49.03 20.21C44.39 19.15 41.1 17.84 41.1 13.59C41.1 9.52 44.43 6.74 49.22 6.74C52.8 6.74 55.59 7.86 57.83 9.78L55.36 13.17C53.41 11.6 51.21 10.74 49.09 10.74C47.08 10.74 45.86 11.8 45.86 13.11C45.86 14.71 47.18 15.22 50.57 15.98C55.3 17.04 58.43 18.45 58.43 22.51C58.43 26.7 55.27 29.48 49.89 29.48Z"
        fill="white"
      />
      <path
        d="M69.17 29.48C64.25 29.48 60.12 25.51 60.12 20.81C60.12 16.11 64.25 12.18 69.17 12.18C74.06 12.18 78.16 16.11 78.16 20.81C78.16 25.51 74.06 29.48 69.17 29.48ZM69.17 25.55C71.63 25.55 73.71 23.37 73.71 20.81C73.71 18.26 71.63 16.11 69.17 16.11C66.68 16.11 64.6 18.26 64.6 20.81C64.6 23.37 66.68 25.55 69.17 25.55Z"
        fill="white"
      />
      <path
        d="M80.68 29.1V6.74H85.35V29.1H80.68Z"
        fill="white"
      />
      <path
        d="M96.91 29.48C91.98 29.48 87.86 25.51 87.86 20.81C87.86 16.11 91.98 12.18 96.91 12.18C101.8 12.18 105.89 16.11 105.89 20.81C105.89 25.51 101.8 29.48 96.91 29.48ZM96.91 25.55C99.37 25.55 101.45 23.37 101.45 20.81C101.45 18.26 99.37 16.11 96.91 16.11C94.41 16.11 92.33 18.26 92.33 20.81C92.33 23.37 94.41 25.55 96.91 25.55Z"
        fill="white"
      />
    </svg>
  );
}


export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-0">
        <div className="flex flex-col gap-8 py-12 px-4 md:px-6">
          {/* Logo */}
          <div className="flex justify-start">
            <Link href="https://supportsheep.com/" className="inline-block">
              <SupportsheepLogo />
            </Link>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8 sm:gap-y-8 lg:gap-y-5">
            {/* Company Column */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium tracking-wide text-background/60">
                Company
              </span>
              <div className="flex flex-col gap-2">
                <Link
                  href="https://supportsheep.com/about?utm_source=blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  About us
                </Link>
                <Link
                  href="https://supportsheep.com/pricing?utm_source=blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Pricing
                </Link>
                <Link
                  href="https://supportsheep.com/businesses?utm_source=blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Featured Businesses
                </Link>
                <Link
                  href="https://supportsheep.com/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Integrations
                </Link>
                <Link
                  href="https://support.supportsheep.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Support
                </Link>
                <Link
                  href="https://support.supportsheep.com/doc/release-notes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Release notes
                </Link>
                <Link
                  href="https://supportsheep.com"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Blog
                </Link>
                <Link
                  href="https://www.youtube.com/watch?v=BTBsgSZO-so&t=2s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Video Demo
                </Link>
              </div>
            </div>

            {/* Tools Column */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium tracking-wide text-background/60">
                Tools
              </span>
              <div className="flex flex-col gap-2">
                <Link
                  href="https://supportsheep.com/business-name-creator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Business Name Creator
                </Link>
                <Link
                  href="https://supportsheep.com/business-idea-creator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Business Idea Creator
                </Link>
                <Link
                  href="https://supportsheep.com/google-ad-creator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Google Ad Creator
                </Link>
              </div>
            </div>

            {/* Create a website Column */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium tracking-wide text-background/60">
                Create a website
              </span>
              <div className="flex flex-col gap-2">
                <Link
                  href="https://supportsheep.com/create-your-website-with-facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Create a site from Facebook
                </Link>
                <Link
                  href="https://supportsheep.com/create-your-website-with-thumbtack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Create a site from Thumbtack
                </Link>
                <Link
                  href="https://supportsheep.com/create-your-website-with-yelp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Create a site from Yelp
                </Link>
                <Link
                  href="https://supportsheep.com/create-a-website-from-a-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Create a site from a link
                </Link>
                <Link
                  href="https://chatgpt.com/g/g-6811592f6ba48191b1d64d7c09624342-solo-ai-website-creator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left text-sm text-background/80 hover:text-background transition-colors no-underline w-fit"
                >
                  Create a site from ChatGPT
                </Link>
              </div>
            </div>
          </div>

          {/* Horizontal Divider */}
          <hr className="border-t border-background/20 my-0" />

          {/* Bottom Section */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              <Link
                href="https://support.supportsheep.com/doc/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-background/80 hover:text-background transition-colors no-underline"
              >
                Privacy Policy
              </Link>
              <Link
                href="https://support.supportsheep.com/doc/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-background/80 hover:text-background transition-colors no-underline"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
