import "server-only";

import { getShareLink } from "@/lib/interviews/share-links-repository";
import type {
  ShareLinkVisibility,
} from "@/lib/interviews/share-link-schema";
import type { UserRole } from "@repo/types";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

/**
 * RBAC resource query for interview documents.
 *
 * Mirrors the admin pattern of `getThreadAccess(thread, session)`:
 * one function that, given a resource and a viewer, returns the viewer's
 * effective role on the resource (or null when they have none). Callers
 * gate access by checking `if (!access) return notFound()` rather than
 * scattering `startedByUid === session.uid` style checks across pages.
 *
 * Access ladder, highest first:
 *   - "owner"  — created the interview directly (self-flow) or is the
 *                share link creator who's now using their own link.
 *   - "admin"  — workspace owner or admin role; sees every interview
 *                in their workspace regardless of authorship.
 *   - "guest"  — joined via an active share link whose visibility
 *                permits this viewer (or whose guestEmail matches the
 *                viewer's Firebase email).
 *
 * Visibility on the share link gates guest access:
 *   - private:   only the share-link creator
 *   - workspace: any signed-in workspace user
 *   - link:      anyone signed in (the URL itself is the gate)
 */

export type InterviewAccess = "owner" | "admin" | "guest";

export interface InterviewAccessRecord {
  startedByUid?: string | null;
  shareLinkId?: string | null;
  guestEmail?: string | null;
  blogId?: string | null;
}

export interface AccessSession {
  uid: string;
  email?: string | null;
  role?: UserRole;
  workspaceId?: string;
}

interface ShareLinkAccessRecord {
  createdBy: string;
  status: string;
  type: ShareLinkVisibility;
  workspaceId: string;
}

async function fetchShareLink(
  shareLinkId: string,
  blogId: string,
): Promise<ShareLinkAccessRecord | null> {
  // Use D1 share links repository
  const row = await getShareLink(blogId, shareLinkId);
  if (!row) return null;
  return {
    createdBy: row.createdBy,
    status: row.status,
    type: row.type,
    workspaceId: row.workspaceId,
  };
}

export async function getInterviewAccess(
  interview: InterviewAccessRecord,
  session: AccessSession,
): Promise<InterviewAccess | null> {
  // 1. Self-flow creator is always the owner.
  if (interview.startedByUid && interview.startedByUid === session.uid) {
    return "owner";
  }

  // 2. Workspace owner / admin sees every interview in *their* workspace —
  //    not every interview anywhere. The interview's `blogId` is the
  //    workspace identifier (the codebase still uses "default" for both
  //    everywhere, but tightening the check now keeps the door shut for
  //    the day multi-workspace lands). If neither side carries an explicit
  //    workspaceId, fall back to "default" so the existing single-tenant
  //    behaviour is preserved.
  if (session.role === "owner" || session.role === "admin") {
    const interviewWorkspace = interview.blogId ?? "default";
    const sessionWorkspace = session.workspaceId ?? "default";
    if (interviewWorkspace === sessionWorkspace) {
      return "admin";
    }
  }

  // 3. Share-link guests: validate against the active share link.
  if (interview.shareLinkId) {
    const blogId = interview.blogId ?? DEFAULT_BLOG_ID;
    const shareLink = await fetchShareLink(interview.shareLinkId, blogId);
    if (shareLink && shareLink.status === "active") {
      // The share-link creator is treated as owner even if they themselves
      // joined as a "guest" of their own link (common during testing).
      if (shareLink.createdBy === session.uid) {
        return "owner";
      }

      // The original guest (matched by email) keeps access.
      if (
        session.email &&
        interview.guestEmail &&
        interview.guestEmail.toLowerCase() === session.email.toLowerCase()
      ) {
        return "guest";
      }

      // Visibility-based access for any other authenticated viewer.
      switch (shareLink.type) {
        case "private":
          // Already short-circuited via createdBy + guestEmail above.
          return null;
        case "workspace":
          // Workspace-scoped: viewer must belong to the share link's workspace.
          if (
            session.workspaceId &&
            session.workspaceId === shareLink.workspaceId
          ) {
            return "guest";
          }
          return null;
        case "link":
          // Anyone with a session — the URL itself is the gate.
          return "guest";
        default:
          return null;
      }
    }
  }

  return null;
}
