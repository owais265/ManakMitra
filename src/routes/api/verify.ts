import { createFileRoute } from "@tanstack/react-router";
import { parseAttachment } from "@/lib/attachments";
import { checkBrand, checkLicence, verdictFromPhotoRead, type VerifyMode } from "@/lib/verify-cert";

function usableKey(key: string): boolean {
  if (key.length < 20) return false;
  const lower = key.toLowerCase();
  return !["dummy", "placeholder", "changeme", "your-key", "xxx"].some((bad) => lower.includes(bad));
}

async function readMark(dataUrl: string): Promise<{ licence?: string | null; isNumber?: string | null; brand?: string | null }> {
  const key = [process.env.XAI_API_KEY, process.env.XAI_API_KEY_2].map((k) => k?.trim() || "").find(usableKey);
  if (!key) return {};
  const models = [process.env.XAI_MODEL?.trim(), "grok-4.5", "grok-3-mini"].filter((m): m is string => Boolean(m));
  const instruction =
    'Read this PNG of a product mark. Reply with JSON only: {"licence":string|null,"isNumber":string|null,"brand":string|null}. Copy a CM/L, R-number, or 6-character HUID into licence if you can see it. Copy only the digits of an IS number into isNumber. Do not judge validity.';
  for (const model of [...new Set(models)]) {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 180,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) continue;
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        licence?: unknown;
        isNumber?: unknown;
        brand?: unknown;
      };
      return {
        licence: typeof parsed.licence === "string" ? parsed.licence : null,
        isNumber: typeof parsed.isNumber === "string" ? parsed.isNumber : null,
        brand: typeof parsed.brand === "string" ? parsed.brand : null,
      };
    } catch {
      continue;
    }
  }
  return {};
}

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { mode?: string; query?: string; attachment?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const mode = body.mode as VerifyMode;
        if (mode !== "licence" && mode !== "brand" && mode !== "photo") {
          return Response.json({ error: "Choose licence, brand, or photo." }, { status: 400 });
        }
        if (mode === "licence") {
          return Response.json(checkLicence(typeof body.query === "string" ? body.query : ""));
        }
        if (mode === "brand") {
          return Response.json(checkBrand(typeof body.query === "string" ? body.query : ""));
        }
        const parsed = parseAttachment(body.attachment);
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
        if (!parsed.attachment || (parsed.attachment.kind !== "png" && parsed.attachment.kind !== "image")) {
          return Response.json({ error: "Attach a photo of the mark." }, { status: 400 });
        }
        const read = await readMark(parsed.attachment.dataUrl);
        return Response.json(verdictFromPhotoRead(read));
      },
    },
  },
});
