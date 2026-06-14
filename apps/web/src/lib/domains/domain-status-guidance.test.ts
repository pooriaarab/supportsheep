import { describe, expect, it } from "vitest";

import type { CustomHostnameResult } from "./cloudflare-saas";
import { getDomainGuidance } from "./domain-status-guidance";

function cf(overrides: Partial<CustomHostnameResult>): CustomHostnameResult {
  return {
    id: "ch_1",
    hostname: "blog.example.com",
    status: "pending",
    sslStatus: "pending_validation",
    sslValidationErrors: [],
    verificationErrors: [],
    dcvTarget: "blogbat.com",
    ownershipVerification: null,
    ...overrides,
  };
}

describe("getDomainGuidance", () => {
  it("reports active when hostname + ssl are active", () => {
    const g = getDomainGuidance(cf({ status: "active", sslStatus: "active" }));
    expect(g.state).toBe("active");
    expect(g.fixHint).toBeNull();
  });

  it("reports active when ssl status is absent but hostname is active", () => {
    const g = getDomainGuidance(cf({ status: "active", sslStatus: null }));
    expect(g.state).toBe("active");
  });

  it("maps a CAA error to actionable guidance", () => {
    const g = getDomainGuidance(
      cf({
        sslStatus: "pending_validation",
        sslValidationErrors: ["caa_error: CAA record prevents issuance"],
      }),
    );
    expect(g.state).toBe("failed");
    expect(g.userMessage.toLowerCase()).toContain("caa");
    expect(g.fixHint?.toLowerCase()).toContain("cloudflare");
  });

  it("maps an AAAA mismatch", () => {
    const g = getDomainGuidance(
      cf({ verificationErrors: ["conflicting AAAA record found"] }),
    );
    expect(g.state).toBe("failed");
    expect(g.userMessage.toLowerCase()).toContain("aaaa");
  });

  it("treats pending_validation as pending", () => {
    const g = getDomainGuidance(cf({ sslStatus: "pending_validation" }));
    expect(g.state).toBe("pending");
    expect(g.fixHint).toBeTruthy();
  });

  it("maps a blocked hostname to failed", () => {
    const g = getDomainGuidance(cf({ status: "blocked", sslStatus: null }));
    expect(g.state).toBe("failed");
  });

  it("maps a moved hostname to failed", () => {
    const g = getDomainGuidance(cf({ status: "moved", sslStatus: null }));
    expect(g.state).toBe("failed");
  });

  it("falls back to pending for an unknown non-active state", () => {
    const g = getDomainGuidance(cf({ status: "provisioning", sslStatus: null }));
    expect(g.state).toBe("pending");
  });
});
