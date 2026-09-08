import { createFileRoute } from "@tanstack/react-router";
import { classifyIntent, offtopicReply, socialReply } from "@/lib/intent";
import { detectLanguage, isAppLang, langPromptName, type AppLang } from "@/lib/language";

type ChatBody = {
  query?: string;
  language?: AppLang;
  history?: { role?: string; text?: string }[];
};

const SYSTEM_PROMPT = (language: AppLang, evidence: string, confidence: string, mode: string) => `You are ManakMitra, an AI assistant for the Bureau of Indian Standards (BIS).
Respond in ${langPromptName(language)}. Write the whole answer in that language (script included).

GOLDEN RULE:
- Answer ONLY using the EVIDENCE block. Do not add IS numbers, fees, dates, or mandatory status that are not in EVIDENCE.
- If EVIDENCE says there are no verified hits, refuse clearly in the same language: say you do not have verified BIS evidence.
- Catalogue rows are metadata (id + title). Never pretend you have the full standard text.
- Fees/timelines only if present in EVIDENCE (official FAQ figures). Tell user to re-check the live FAQ.

Help with: Indian Standards from product descriptions, ISI / CRS / FMCS / QCO, hallmarking/HUID, labs, consumer complaints.

EVIDENCE (authorised pack, last verified 2026-09-08):
${evidence}

Suggested confidence: ${confidence}
Suggested contextMode: ${mode}

Format with markdown headings and bullets.

At the very end, on separate lines:
[SOURCE] Title | Type | Date | Link
[FOLLOW_UP] Specific follow-up question
[META] confidence (high/medium/low) | contextMode (standards/hallmarking/general)

If a process is in evidence, also:
[PROCESS_STEPS] Step 1 Name | Step 2 Name | Step 3 Name | Step 4 Name`;

const SOCIAL_PROMPT = (language: AppLang) => `You are ManakMitra, a warm BIS (Bureau of Indian Standards) assistant.
Respond in ${langPromptName(language)}. Write the whole reply in that language.
The user is greeting you or asking who you are / what you can do.
Be friendly in 4–8 short sentences. Stay in character: you ONLY help with Indian Standards, ISI/CRS/FMCS/QCO, hallmarking/HUID, labs, and consumer complaints.
Do not invent IS numbers, fees, or legal advice.
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
  maxTokens = 700,
): Promise<Response | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];

  for (const msg of (history || []).filter((m) => m?.text?.trim()).slice(-3)) {
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
          language = detectLanguage(query, language);
          history = body.history || [];
          if (!query.trim()) {
            return new Response(
              language === "hi" ? "कृपया अपना प्रश्न दर्ज करें।" : "Please enter your question.",
              { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
            );
          }
          const intent = classifyIntent(query);
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
          const { retrieve, formatEvidenceBlock } = await import("@/lib/retrieve");
          const { getFallbackBISResponse } = await import("@/lib/bisKnowledge");
          const retrieved = retrieve(query);
          if (retrieved.hasEvidence) {
            const evidence = formatEvidenceBlock(retrieved);
            const live = await streamXaiMessages(
              query,
              language,
              history,
              SYSTEM_PROMPT(language, evidence, retrieved.confidence, retrieved.mode),
              getFallbackBISResponse(query, language),
            );
            return live ?? streamText(getFallbackBISResponse(query, language));
          }
          if (intent === "offtopic") {
            return streamText(offtopicReply(language));
          }
          return streamText(getFallbackBISResponse(query, language));
        } catch {
          return new Response(
            language === "hi"
              ? "Mujhe verified BIS source se jawab nahi mil paya. Know Your Standard portal try karein."
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
