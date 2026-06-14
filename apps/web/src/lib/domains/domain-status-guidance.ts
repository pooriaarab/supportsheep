/**
 * Map a Cloudflare for SaaS custom-hostname status (hostname status + SSL
 * status + validation errors) to actionable, plain-English guidance shown in
 * the dashboard and in failure emails. Pure and dependency-free so it is easy
 * to unit test and safe to call from anywhere (server or build).
 */

import type { CustomHostnameResult } from "./cloudflare-saas";

/** The verification state we surface to the owner, derived from Cloudflare. */
export type DomainGuidanceState = "active" | "pending" | "failed";

export interface DomainGuidance {
  /** Coarse state for badges / branching. */
  state: DomainGuidanceState;
  /** One-line summary of what is happening, in plain English. */
  userMessage: string;
  /** Concrete next step the owner can take, or null when none is needed. */
  fixHint: string | null;
}

/** Lowercased haystack of every error/status string Cloudflare returned. */
function errorHaystack(cf: CustomHostnameResult): string {
  return [
    cf.sslStatus ?? "",
    ...cf.sslValidationErrors,
    ...cf.verificationErrors,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Map a normalized Cloudflare hostname result to guidance. Recognizes the
 * common failure modes (CAA blocking issuance, AAAA/record mismatch, DCV still
 * pending, blocked/moved hostnames) and falls back to a generic message.
 */
export function getDomainGuidance(cf: CustomHostnameResult): DomainGuidance {
  // Fully provisioned.
  if (
    cf.status === "active" &&
    (cf.sslStatus === null || cf.sslStatus === "active")
  ) {
    return {
      state: "active",
      userMessage: "Your domain is verified and serving over HTTPS.",
      fixHint: null,
    };
  }

  const haystack = errorHaystack(cf);

  // CAA records block the certificate authority from issuing the cert.
  if (haystack.includes("caa")) {
    return {
      state: "failed",
      userMessage:
        "Your domain has CAA records that block certificate issuance.",
      fixHint:
        "Remove the CAA records on your domain, or add one that allows Cloudflare's certificate authority (e.g. `0 issue \"letsencrypt.org\"` and `0 issue \"pki.goog\"`). Then recheck.",
    };
  }

  // An AAAA (IPv6) record on the host shadows the CNAME and breaks routing.
  if (haystack.includes("aaaa")) {
    return {
      state: "failed",
      userMessage:
        "An AAAA (IPv6) record on your domain is conflicting with the required CNAME.",
      fixHint:
        "Remove any A/AAAA records for this host so only the CNAME remains, then recheck.",
    };
  }

  // Hostname was blocked or moved to another zone — not recoverable here.
  if (cf.status === "blocked" || cf.status === "moved" || cf.status === "deleted") {
    return {
      state: "failed",
      userMessage:
        cf.status === "blocked"
          ? "This domain was blocked and cannot be served."
          : "This domain is no longer pointed at BlogBat.",
      fixHint:
        "Confirm you control this domain and that its DNS still points at BlogBat, then remove and re-add it.",
    };
  }

  // DCV / DNS still propagating — this is the normal "pending" path.
  if (
    cf.sslStatus === "pending_validation" ||
    cf.sslStatus === "pending_deployment" ||
    cf.sslStatus === "initializing" ||
    cf.status === "pending" ||
    cf.status === "active_redeploying"
  ) {
    return {
      state: "pending",
      userMessage:
        "Waiting for your DNS change to propagate and for the certificate to be issued.",
      fixHint:
        "Make sure the CNAME (and any ownership-verification record) below are added at your DNS provider. This can take a few minutes.",
    };
  }

  // Any other non-active SSL/hostname state with reported errors.
  if (cf.sslValidationErrors.length > 0 || cf.verificationErrors.length > 0) {
    return {
      state: "failed",
      userMessage: "Your domain could not be verified.",
      fixHint:
        "Double-check the DNS records below match exactly, with no extra A/AAAA/CAA records on the host, then recheck.",
    };
  }

  // Unknown but not-yet-active — treat as still pending.
  return {
    state: "pending",
    userMessage: "Your domain is still being verified.",
    fixHint:
      "Confirm the DNS records below are in place, then recheck in a few minutes.",
  };
}
