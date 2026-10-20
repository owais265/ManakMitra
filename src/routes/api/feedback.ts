import { createFileRoute } from "@tanstack/react-router";
import { sanitizeFeedback } from "@/lib/feedback-packet";
import { FEEDBACK_HOURS, saveFeedback } from "@/lib/feedback-store.server";
import { clientIp, takeLimit } from "@/lib/rate-limit";

const MAX_BODY = 24_000;

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = takeLimit(`feedback:${clientIp(request)}`);
        if (!gate.ok) {
          return Response.json(
            { error: "Too many requests." },
            { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
          );
        }
        const text = await request.text();
        if (text.length > MAX_BODY) return Response.json({ error: "Packet is too large." }, { status: 400 });
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const packet = sanitizeFeedback(body);
        if (!packet) return Response.json({ error: "Send kind up, down, or report." }, { status: 400 });
        const saved = await saveFeedback(packet);
        if (!saved.ok) {
          const status = saved.status;
          const error = status === 503 ? "Feedback store is not ready." : "Feedback was not saved.";
          return Response.json({ error }, { status });
        }
        return Response.json({ ok: true, keptHours: FEEDBACK_HOURS });
      },
    },
  },
});
