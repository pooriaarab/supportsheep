import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createApiHandler } from "@/lib/create-api-handler";
import { getBlogConfig } from "@/lib/blog-config";
import {
  getInterviewByTavusConversationId,
  updateInterview,
} from "@/lib/interviews/interviews-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";
import { getMediaBucket } from "@/lib/media/bucket";

const log = createLogger("api:integrations:webhooks:tavus");

export const POST = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    // 1. Resolve API key from blog config to verify request signature
    const config = await getBlogConfig();
    const apiKey = config.ai?.providers?.tavus?.apiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tavus integration not configured" },
        { status: 500 },
      );
    }

    const signature = request.headers.get("x-tavus-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const bodyText = await request.text();
    const hmac = createHmac("sha256", apiKey);
    const expectedSignature = hmac.update(bodyText).digest("hex");

    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse the verified payload
    const payload = JSON.parse(bodyText);

    // If it's not the recording event, acknowledge with 200 OK so Tavus doesn't retry
    if (payload.event_type !== "application.recording_ready") {
      return NextResponse.json({ received: true });
    }

    const conversationId = payload.conversation_id;
    const videoUrl = payload.properties?.recording_url;

    if (!conversationId || !videoUrl) {
      return NextResponse.json(
        { error: "Missing required properties" },
        { status: 400 },
      );
    }

    // Defense-in-depth: validate the recording URL host even though HMAC
    // already authenticates the webhook. Reduces SSRF surface if Tavus's
    // signing key is ever compromised — fetch is only allowed against
    // Tavus's own infrastructure.
    let parsedVideoUrl: URL;
    try {
      parsedVideoUrl = new URL(videoUrl);
    } catch {
      return NextResponse.json({ error: "Invalid recording URL" }, { status: 400 });
    }
    if (parsedVideoUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid recording URL" }, { status: 400 });
    }
    const allowedHostSuffixes = ["tavusapi.com", "tavus.io", "amazonaws.com"];
    const hostMatches = allowedHostSuffixes.some((suffix) =>
      parsedVideoUrl.hostname === suffix || parsedVideoUrl.hostname.endsWith(`.${suffix}`),
    );
    if (!hostMatches) {
      return NextResponse.json({ error: "Invalid recording URL" }, { status: 400 });
    }

    // 3. Locate the corresponding interview record
    const interview = await getInterviewByTavusConversationId(
      DEFAULT_blog_id,
      conversationId,
    );

    if (!interview) {
      return NextResponse.json(
        { error: "Interview record not found" },
        { status: 404 },
      );
    }

    const interviewId = interview.id;

    // 4. Download video from Tavus storage
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download Tavus video (${videoRes.status})`);
    }
    const arrayBuffer = await videoRes.arrayBuffer();

    // 5. Save the recording to R2. Kept non-fatal (try/catch) so a storage
    //    misconfiguration never blocks the interview doc update — this is a
    //    webhook Tavus would otherwise retry.
    const storagePath = `interviews/${interviewId}/video.webm`;
    try {
      await getMediaBucket().put(storagePath, arrayBuffer, {
        httpMetadata: { contentType: "video/webm" },
      });
    } catch (storageError) {
      // Non-fatal: log and continue so the interview doc is always updated.
      log.error("Failed to save recording to R2", {
        interviewId,
        error: storageError,
      });
    }

    // 6. Update the interview record in D1 with the R2 recording key.
    await updateInterview(DEFAULT_blog_id, interviewId, {
      videoStoragePath: storagePath,
    });

    // Minimal response — webhook callers don't need internal IDs.
    return NextResponse.json({ success: true });
  },
});
