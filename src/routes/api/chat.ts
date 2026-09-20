import { createFileRoute } from "@tanstack/react-router";
import { classifyIntent, offtopicReply, socialReply } from "@/lib/intent";
import { isAppLang, langPromptName, UI_DICTIONARY, type AppLang } from "@/lib/language";

type ChatBody = {
  query?: string;
  language?: AppLang;
};

const SYSTEM_PROMPT = (language: AppLang, evidence: string, confidence: string, mode: string) => `You are ManakMitra, a short-form helpdesk for Indian Standards and BIS services. You answer from a public BIS catalogue (IS titles, schemes, hallmarking, labs, complaints). Do not claim you are built by BIS or the Government of India.
Respond in ${langPromptName(language)}.

LANGUAGE LOCK (mandatory):
- The reply language is ONLY the selected UI language: ${langPromptName(language)}. Do NOT detect or switch language from the user's query.
- Keep official tokens as-is: IS numbers, BIS, ISI, CRS, FMCS, QCO, HUID, portal names, URLs.
- [SOURCE] [FOLLOW_UP] [META] [PROCESS_STEPS] tag names stay English; FOLLOW_UP text in ${langPromptName(language)}.

SHAPE (mandatory):
- First line answers the ask. Then 3–6 short bullets or numbered steps. Then official URL(s) from EVIDENCE.
- At most ~120 words / 8 lines of visible prose before the tags.
- NO markdown headings (no # ## ###). No "Comprehensive Overview". No BIS Act / 22,000-standards / e-BIS architecture lecture unless they asked "what is BIS".
- Calm tone. Do not say "I am not a general chatbot" on BIS questions.

GOLDEN RULE:
- Answer ONLY using EVIDENCE. Do not invent IS numbers, fees, dates, clauses, or QCO status.
- If EVIDENCE has no verified hits, say so in one or two lines and point to Know Your Standard.
- If EVIDENCE starts with GROUNDING: refuse, do not invent an IS number, fee, clause, or lab accreditation.
- Catalogue rows are metadata (id + title). Never quote paid clause text.
- Fees only if present in EVIDENCE — "BIS FAQ figure — re-check the live FAQ".
- Use THIS query only. Do not reuse a product or IS from any earlier message.
- If EVIDENCE has a disambiguation NOTE, ask that ONE question first. Do not assume gold 22K/916, a helmet type, a pipe material, or jeweller-vs-consumer. Do not emit [PROCESS_STEPS] until they specify.
- Labs: names in EVIDENCE only. Confirm live scope on BIS LIMS. Never "accredited for IS X".
- How to apply / ISI / CRS / FMCS: numbered 4–6 steps from process rows + the full host https://www.manakonline.in or https://www.crsbis.in from EVIDENCE, not a search engine. Never write akonline.in.
- CONSUMER hallmark / HUID / CARE / verify gold: [PROCESS_STEPS] = BIS CARE Verify HUID only. FORBIDDEN: Apply online as jeweller, Submit with no docs/fee, Get instant registration, Sell only AHC-hallmarked pieces.
- JEWELLER / AHC / hallmark licence: hallmarking registration process rows only.
- Not a tender/procurement engine.

EVIDENCE:
${evidence}

Suggested confidence: ${confidence}
Suggested contextMode: ${mode}

End on separate lines:
[SOURCE] Title | Type | Date | Link
[FOLLOW_UP] One recommended next lookup (a product or BIS service name). Do NOT write a question — no which/what/how, no question mark.
[META] confidence (high/medium/low) | contextMode (standards/hallmarking/general)
If process rows exist AND the user asked how to apply / verify (not a vague one-word product):
[PROCESS_STEPS] Step 1 | Step 2 | Step 3 | Step 4
If a disambiguation NOTE is present, omit [PROCESS_STEPS].`;

const SOCIAL_PROMPT = (language: AppLang) => `You are ManakMitra. Respond in ${langPromptName(language)}. LANGUAGE LOCK: selected UI language only. Do not mix languages. Keep BIS/ISI/CRS/HUID and URLs in English form.
The user is greeting you or asking who you are.
Reply in 3–5 short sentences: greet them, say you help with Indian Standards, ISI/CRS, hallmarking, labs, and complaints, then name 1–2 example lookups (cement ISI, laptop CRS, gold HUID). Do not ask the user a question.
No catalogue dump, no Manakonline lecture, no BIS Act, no "22,000 standards".
Do not invent IS numbers or fees.
Do not mention Smart India Hackathon, prototype, or government ownership.
At the end:
[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] One recommended next lookup (product or BIS service name, not a question)
[META] high | general`;

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunkSize = 80;
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function xaiKey(): string {
  return (process.env.XAI_API_KEY_2 ?? process.env.XAI_API_KEY)?.trim() || "";
}

async function streamXaiMessages(
  query: string,
  language: AppLang,
  system: string,
  fallbackText: string,
  temperature = 0.1,
  maxTokens = 900,
): Promise<Response> {
  const apiKey = xaiKey();
  if (!apiKey) {
    console.warn("[chat] xAI skipped: no XAI_API_KEY_2 or XAI_API_KEY — pack fallback");
    return streamText(fallbackText);
  }
  const model = process.env.XAI_MODEL?.trim() || "grok-4.5";
  console.info(`[chat] xAI request model=${model}`);

  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: query.slice(0, 1200) },
        ],
      }),
    });
  } catch (error) {
    console.error("[chat] xAI threw:", error instanceof Error ? error.message : error);
    return streamText(fallbackText);
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error(`[chat] xAI failed (${res.status || "no-body"}):`, detail.slice(0, 500));
    return streamText(fallbackText);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  const fallback = fallbackText;

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
              };
              const text = json.choices?.[0]?.delta?.content;
              if (text) {
                total += text.length;
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
        if (total === 0) {
          console.error("[chat] xAI empty stream — pack fallback");
          controller.enqueue(encoder.encode(fallback));
        }
        controller.close();
      } catch (error) {
        console.error("[chat] xAI stream failed:", error instanceof Error ? error.message : error);
        try {
          if (total === 0) controller.enqueue(encoder.encode(fallback));
        } catch {
          // ignore
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let query = "";
        let language: AppLang = "en";
        try {
          const body = (await request.json()) as ChatBody;
          query = body.query || "";
          language = isAppLang(body.language) ? body.language : "en";
          if (!query.trim()) {
            return new Response(
              UI_DICTIONARY[language].emptyQuery,
              { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
            );
          }
          const intent = classifyIntent(query);
          const retrievalQuery = query.trim();
          if (intent === "social") {
            return streamXaiMessages(
              query,
              language,
              SOCIAL_PROMPT(language),
              socialReply(language),
              0.4,
              500,
            );
          }
          if (intent === "offtopic") {
            return streamText(offtopicReply(language));
          }
          const { retrieveHybrid, formatEvidenceBlock } = await import("@/lib/retrieve");
          const { getFallbackBISResponse } = await import("@/lib/bisKnowledge");
          const retrieved = await retrieveHybrid(retrievalQuery);
          const pack = getFallbackBISResponse(retrievalQuery, language);
          console.info(`[chat] retrieval evidence=${retrieved.hasEvidence} hits=${retrieved.hits.length} confidence=${retrieved.confidence} mode=${retrieved.mode}`);
          if (retrieved.hasEvidence) {
            const evidence = formatEvidenceBlock(retrieved);
            return streamXaiMessages(
              query,
              language,
              SYSTEM_PROMPT(language, evidence, retrieved.confidence, retrieved.mode),
              pack,
            );
          }
          return streamText(pack);
        } catch {
          return new Response(UI_DICTIONARY[language].catalogueLoadError, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
