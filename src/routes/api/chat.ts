import { createFileRoute } from "@tanstack/react-router";
import { classifyIntent, offtopicReply, socialReply } from "@/lib/intent";
import { isAppLang, langPromptName, type AppLang } from "@/lib/language";
import { rewriteQuery, type ChatTurn } from "@/lib/query-context";

type ChatBody = {
  query?: string;
  language?: AppLang;
  history?: ChatTurn[];
};

const SYSTEM_PROMPT = (language: AppLang, evidence: string, confidence: string, mode: string) => `You are ManakMitra, an AI assistant for the Bureau of Indian Standards (BIS).
Respond in ${langPromptName(language)}.

LANGUAGE LOCK (mandatory):
- The reply language is ONLY the selected UI language: ${langPromptName(language)}. Do NOT detect or switch language from the user's query.
- Write every sentence, heading, and follow-up in that language. Do not mix Hindi and English in the same answer.
- If English: Latin English only. No Devanagari. No Hinglish (no kya/hai/batao/ke liye filler).
- If Hindi: Devanagari Hindi only for prose. Keep official tokens as-is: IS numbers, BIS, ISI, CRS, FMCS, QCO, HUID, portal names, and URLs.
- [SOURCE] [FOLLOW_UP] [META] [PROCESS_STEPS] tag names stay English; the FOLLOW_UP question text must be in ${langPromptName(language)}.

GOLDEN RULE:
- Answer ONLY using the EVIDENCE block. Do not add IS numbers, fees, dates, clause numbers, or mandatory status that are not in EVIDENCE.
- If EVIDENCE says there are no verified hits, refuse clearly in the same language.
- Catalogue rows are metadata (id + title). Never pretend you have the full standard text or a clause. If the user asks what a clause says: state that clause text is not stored, give the catalogue title, and point to Know Your Standard and e-Sale URLs in EVIDENCE. Never invent clause wording.
- Fees/timelines only if present in EVIDENCE (official FAQ figures). Quote them as "BIS FAQ figure — re-check the live FAQ".
- Use earlier chat context: if the user says "now the process / lab / fee", keep the same product / IS from the conversation.
- If EVIDENCE has a NOTE about disambiguation (helmet types, mixer vs concrete mixer), ask that in one line.
- Do not say a product is under a QCO / compulsory unless a row in EVIDENCE says so for that product.
- Labs: name only labs in EVIDENCE. Never say a lab is accredited to test a named IS. Tell the user to confirm live scope on BIS LIMS.
- If the user asks about tenders or procurement specifications, say this assistant is for MSME/consumer BIS guidance (standards, schemes, hallmark, labs), not a procurement recommendation engine.

Help with: Indian Standards from product descriptions, ISI / CRS / FMCS / QCO, hallmarking/HUID, labs, consumer complaints, training/enquiry contacts if in evidence.

EVIDENCE (authorised pack, last verified 2026-09-08):
${evidence}

Suggested confidence: ${confidence}
Suggested contextMode: ${mode}

Write markdown with this shape when evidence exists. Translate section headings into the user language (do not leave English headings inside a Hindi answer):
## Applicable (catalogue metadata)
Rank up to 3 IS / scheme rows. One line why (from the title only).
## Related in this pack
Allied rows only if they appear in EVIDENCE.
## Scheme / process / lab
Include scheme steps when process rows are in EVIDENCE — even on the first product question. Group-1 labs: confirm live scope on BIS LIMS / the Group-1 PDF.
## What this is not
One line: full clause text is not stored; read/buy the IS on the official portal. This is not a licence and not legal advice.

At the very end, on separate lines:
[SOURCE] Title | Type | Date | Link
[FOLLOW_UP] Specific follow-up question
[META] confidence (high/medium/low) | contextMode (standards/hallmarking/general)

If a process is in evidence, also:
[PROCESS_STEPS] Step 1 Name | Step 2 Name | Step 3 Name | Step 4 Name`;

const SOCIAL_PROMPT = (language: AppLang) => `You are ManakMitra, a warm BIS (Bureau of Indian Standards) assistant.
Respond in ${langPromptName(language)}. LANGUAGE LOCK: the selected UI language is ${langPromptName(language)}. Do not detect language from the query. Do not mix Hindi and English. English = Latin only. Hindi = Devanagari prose; keep BIS/ISI/CRS/HUID and URLs in official English form.
The user is greeting you or asking who you are / what you can do.
Be friendly in 4–8 short sentences. Stay in character: you ONLY help with Indian Standards, ISI/CRS/FMCS/QCO, hallmarking/HUID, labs, and consumer complaints.
One sentence: you are not a tender/procurement specification engine — you help MSME and consumer BIS questions.
Do not invent IS numbers, fees, or legal advice.
Do not mention SIH problem numbers unless the user asks about tenders/procurement.
Invite one specific next BIS question (product, mark, lab, or process).
At the end, on separate lines:
[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] A specific BIS follow-up question
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

async function streamXaiMessages(
  query: string,
  language: AppLang,
  history: ChatBody["history"],
  system: string,
  fallbackText: string,
  temperature = 0.1,
  maxTokens = 900,
): Promise<Response | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];

  for (const msg of (history || []).filter((m) => m?.text?.trim()).slice(-8)) {
    messages.push({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.text!.slice(0, 500),
    });
  }
  messages.push({ role: "user", content: query.slice(0, 1200) });

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      stream: true,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  if (!res.ok || !res.body) return null;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

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
              // skip
            }
          }
        }
        if (total === 0) {
          controller.enqueue(encoder.encode(fallbackText));
        }
        controller.close();
      } catch {
        try {
          controller.enqueue(encoder.encode("\n\n" + fallbackText));
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
        let history: ChatBody["history"] = [];
        try {
          const body = (await request.json()) as ChatBody;
          query = body.query || "";
          language = isAppLang(body.language) ? body.language : "en";
          history = body.history || [];
          if (!query.trim()) {
            return new Response(
              language === "hi" ? "कृपया अपना प्रश्न दर्ज करें।" : "Please enter your question.",
              { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
            );
          }
          const intent = classifyIntent(query, history);
          const retrievalQuery = rewriteQuery(query, history);
          if (intent === "social") {
            const live = await streamXaiMessages(
              query,
              language,
              history,
              SOCIAL_PROMPT(language),
              socialReply(language),
              0.4,
              500,
            );
            return live ?? streamText(socialReply(language));
          }
          if (intent === "offtopic") {
            return streamText(offtopicReply(language));
          }
          const { retrieve, formatEvidenceBlock } = await import("@/lib/retrieve");
          const { getFallbackBISResponse } = await import("@/lib/bisKnowledge");
          const retrieved = retrieve(retrievalQuery);
          if (retrieved.hasEvidence) {
            const evidence = formatEvidenceBlock(retrieved);
            const live = await streamXaiMessages(
              retrievalQuery !== query ? `${query}\n\n(Keep product context: ${retrievalQuery.slice(0, 300)})` : query,
              language,
              history,
              SYSTEM_PROMPT(language, evidence, retrieved.confidence, retrieved.mode),
              getFallbackBISResponse(retrievalQuery, language),
            );
            return live ?? streamText(getFallbackBISResponse(retrievalQuery, language));
          }
          return streamText(getFallbackBISResponse(retrievalQuery, language));
        } catch {
          return new Response(
            language === "hi" || language === "mr"
              ? "अभी BIS कैटलॉग लोड नहीं हो पाया। कृपया फिर कोशिश करें या Know Your Standard इस्तेमाल करें।"
              : "I could not load the BIS catalogue just then. Please try again or use Know Your Standard.",
            {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
