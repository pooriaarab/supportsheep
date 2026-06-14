import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  /**
   * Optional one-line reason captured for telemetry. The model should pass a
   * short string ("user requested wrap-up", "questions complete") so the
   * audit log can distinguish guest-driven endings from cap-driven endings.
   * Not surfaced to the user.
   */
  reason: z.string().max(200).optional(),
});

/**
 * Session-lifecycle tool — fires when the user verbally signals the
 * interview is over ("end the interview", "let's wrap up", "we're done",
 * "stop", …). The handler is a pure ack: the actual /end POST happens
 * client-side via the same flow the End Session button uses, triggered by
 * the realtime data channel's `onToolCall` callback (see
 * `use-interview-session.ts`). Registering the tool here serves two
 * purposes:
 *  - advertises the tool to the OpenAI Realtime session so the model can
 *    actually call it instead of hallucinating goodbye lines.
 *  - lets the server-side dispatcher record the call in `tool_executions`
 *    audit logs alongside every other tool invocation.
 *
 * Capped at 2 calls per session — a single user "end the interview"
 * signal should produce one call, with a second slot reserved for the
 * brief confirmation-then-call pattern the system prompt prescribes.
 */
export default {
  name: "end_interview",
  description:
    "End the interview session immediately. Call this when the user signals they want to stop ('end the interview', 'wrap up', 'we're done', 'stop', etc.). Confirm once briefly, then call this tool — do not just say goodbye.",
  category: "lifecycle",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 2,
  handler: (args, ctx) => {
    ctx.logger.info("end_interview tool invoked", {
      interviewId: ctx.interviewId,
      reason: args.reason ?? null,
    });
    return {
      ok: true,
      summary: `end_requested${args.reason ? `:${args.reason.slice(0, 80)}` : ""}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
