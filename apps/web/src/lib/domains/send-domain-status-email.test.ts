import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();
const listMembersMock = vi.fn();

vi.mock("@/lib/email/cloudflare-email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock("@/lib/tenancy/members", () => ({
  listBlogMembers: (...args: unknown[]) => listMembersMock(...args),
}));

import type { CustomHostnameResult } from "./cloudflare-saas";
import type { DomainGuidance } from "./domain-status-guidance";
import {
  sendDomainActivatedEmail,
  sendDomainFailedEmail,
} from "./send-domain-status-email";

function member(role: string, email: string) {
  return {
    id: email,
    name: email,
    email,
    role,
    avatarUrl: "",
    joinedAt: "",
    status: "active" as const,
  };
}

const cf: CustomHostnameResult = {
  id: "ch_1",
  hostname: "blog.example.com",
  status: "pending",
  sslStatus: "pending_validation",
  sslValidationErrors: ["caa_error"],
  verificationErrors: [],
  dcvTarget: "blogbat.com",
  ownershipVerification: {
    type: "txt",
    name: "_cf.blog.example.com",
    value: "verify-123",
  },
};

const guidance: DomainGuidance = {
  state: "failed",
  userMessage: "Your domain has CAA records blocking issuance.",
  fixHint: "Remove the CAA records.",
};

describe("domain status emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue({ id: "msg" });
  });

  it("emails only owners and admins, deduped, via the shared CF emailer", async () => {
    listMembersMock.mockResolvedValue([
      member("owner", "owner@x.test"),
      member("admin", "admin@x.test"),
      member("editor", "editor@x.test"),
      member("viewer", "viewer@x.test"),
      member("admin", "owner@x.test"), // duplicate address
    ]);
    await sendDomainActivatedEmail("b1", "blog.example.com");
    const recipients = sendEmailMock.mock.calls.map((c) => c[0].to);
    expect(recipients.sort()).toEqual(["admin@x.test", "owner@x.test"]);
    // Sent with both text and html bodies.
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      text: expect.any(String),
      html: expect.any(String),
    });
  });

  it("does nothing when there are no owner/admin recipients", async () => {
    listMembersMock.mockResolvedValue([member("editor", "e@x.test")]);
    await sendDomainActivatedEmail("b1", "blog.example.com");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("failure email includes a DNS records table and the fix hint", async () => {
    listMembersMock.mockResolvedValue([member("owner", "owner@x.test")]);
    await sendDomainFailedEmail("b1", cf, guidance);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.subject.toLowerCase()).toContain("could not be verified");
    expect(sent.html).toContain("blogbat.com"); // the CNAME target
    expect(sent.html).toContain("verify-123"); // ownership record
    expect(sent.html).toContain("Remove the CAA records");
    expect(sent.text).toContain("blog.example.com");
  });

  it("completes when the shared emailer reports a no-op (best-effort)", async () => {
    // The shared sendEmail is best-effort and resolves {id:null} rather than
    // throwing when delivery is unavailable; the flow must still complete.
    listMembersMock.mockResolvedValue([member("owner", "owner@x.test")]);
    sendEmailMock.mockResolvedValue({ id: null });
    await expect(
      sendDomainActivatedEmail("b1", "blog.example.com"),
    ).resolves.toBeUndefined();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
