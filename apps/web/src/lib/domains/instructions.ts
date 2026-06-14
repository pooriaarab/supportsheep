/**
 * Human-readable DNS setup steps for a custom domain, returned by the
 * blog-scoped custom-domain API so owners know exactly which records to add.
 */

/** The Cloudflare for SaaS ownership-verification record an owner must add. */
export interface OwnershipVerification {
  type: string;
  name: string;
  value: string;
}

/**
 * Build the steps for adding the required DNS records — the CNAME plus, when
 * present, the ownership-verification TXT — at the owner's DNS provider.
 *
 * The host-field caveat is critical: a real owner pasted the full TXT name
 * (`_cf-custom-hostname.blog.example.com`) into name.com's "Host" field, which
 * auto-appended the zone and produced a doubled record that never validated.
 */
export function buildInstructions(
  domain: string,
  cnameTarget: string,
  ownershipVerification?: OwnershipVerification | null,
): string[] {
  const steps = [
    `Log in to your DNS provider for ${domain}.`,
    `Add a CNAME record: ${domain} → ${cnameTarget}`,
  ];
  if (ownershipVerification) {
    steps.push(
      `Add an ownership-verification ${ownershipVerification.type.toUpperCase()} record: ${ownershipVerification.name} → ${ownershipVerification.value}`,
    );
  }
  steps.push(
    "Note: the Name shown is the full record name. Many providers (name.com, Namecheap, GoDaddy) auto-append your domain to the Host/Name field — if yours does, enter only the part before your domain. Don't repeat your domain or you'll create a doubled record that never verifies.",
    "Save the records, then return here and check status. DNS and certificate validation can take a few minutes.",
  );
  return steps;
}
