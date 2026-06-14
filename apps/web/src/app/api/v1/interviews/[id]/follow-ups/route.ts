import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { listAllEvents } from "@/lib/interviews/events-repository";
import { suggestFollowUps } from "@/lib/interviews/follow-up-suggester";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

// In-memory rate limiting map: interviewId -> lastCalledTimestamp
const rateLimitMap = new Map<string, number>();

export const POST = createApiHandler({
  auth: "user",
  handler: async ({ params, role }) => {
    const { id } = params as { id: string };

    // 1. Enforce write-capable role (owner/admin/editor).
    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2. Enforce 30s rate limiting per interview
    const lastCalled = rateLimitMap.get(id) || 0;
    const now = Date.now();
    if (now - lastCalled < 30000) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429 }
      );
    }

    // 3. Fetch the interview
    const interview = await getInterview(DEFAULT_BLOG_ID, id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    rateLimitMap.set(id, now);

    const topic = interview.topic || "general discussion";
    const style = interview.style || "smart";

    // 4. Reads recent transcript events
    const events = await listAllEvents(DEFAULT_BLOG_ID, id, {
      kinds: ["transcript_user", "transcript_ai"],
    });

    const transcriptLines = events.map((ev) => {
      const speaker = ev.kind === "transcript_user" ? "Guest" : "Interviewer";
      const text = (ev.payload as { text?: string })?.text || "";
      return `${speaker}: ${text}`;
    });

    const fullTranscript = transcriptLines.join("\n");
    // Get last ~2000 characters
    const transcript =
      fullTranscript.length > 2000 ? fullTranscript.slice(-2000) : fullTranscript;

    // 5. Suggest follow-ups
    const suggestions = await suggestFollowUps({
      topic,
      style,
      transcript,
    });

    return NextResponse.json({ suggestions });
  },
});
