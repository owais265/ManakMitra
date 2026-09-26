import { createFileRoute } from "@tanstack/react-router";
import { classifyIntent, offtopicReply, socialReply } from "@/lib/intent";
import { deskKind, deskReply } from "@/lib/desk-route";
import { moreKind, moreReply } from "@/lib/more-desk";
import { isHallmarkSchemeMix } from "@/lib/product-playbook";
import { isAppLang, langPromptName, UI_DICTIONARY, type AppLang } from "@/lib/language";
import { modelPrompt, parseAttachment, retrievalText, type ReadyAttachment } from "@/lib/attachments";

type ChatBody = {
  query?: string;
  language?: AppLang;
  attachment?: unknown;
};

const SYSTEM_PROMPT = (language: AppLang, evidence: string, confidence: string, mode: string) => `You are ManakMitra. You sound like a careful colleague who just checked the public BIS catalogue, not like a database printout and not like a general chatbot. You do not claim you are built by BIS or the Government of India.
Respond in ${langPromptName(language)}.

LANGUAGE LOCK (mandatory):
- The reply language is ONLY the selected UI language: ${langPromptName(language)}. Do NOT detect or switch language from the user's query.
- Keep official tokens as-is: IS numbers, BIS, ISI, CRS, FMCS, QCO, HUID, portal names, URLs.
- [SOURCE] [FOLLOW_UP] [META] [PROCESS_STEPS] tag names stay English; FOLLOW_UP text in ${langPromptName(language)}.

HOW TO ANSWER (mandatory):
- Read the user's sentence first. Answer that exact product, IS number, or service. Do not switch to a nearby topic.
- Use only the EVIDENCE row that matches those words. If they named an IS number and that number is in EVIDENCE, that row is the answer, not a fineness grade and not a different product.
- First sentence: plain answer in everyday words, naming the matched title. Then 2–4 short sentences or up to 5 bullets. Official URL from EVIDENCE at the end of the prose.
- Sound human: "For a ceiling fan, the catalogue row is…" not "Relevant BIS catalogue hits include…". No "Comprehensive Overview". No headings. No BIS Act or "22,000 standards" lecture unless they asked what BIS is.
- At most ~130 words before the tags. Friendly and brief. Do not say "I am not a general chatbot".
- If a disambiguation NOTE is in EVIDENCE, ask that one question in a normal sentence before naming a single IS. No [PROCESS_STEPS] until they answer.
- If EVIDENCE is a refusal or has no matching row, say so in one friendly line and give the official link. Do not invent a nearer answer.
- Steps (how to apply, ISI, CRS, FMCS, HUID check) stay numbered and short, still in a human voice.

GOLDEN RULE:
- Answer ONLY using EVIDENCE. Do not invent IS numbers, fees, dates, clauses, or QCO status.
- If EVIDENCE has no verified hits, say so in one or two lines and point to Know Your Standard.
- If EVIDENCE starts with GROUNDING: refuse, do not invent an IS number, fee, clause, or lab accreditation.
- Catalogue rows are metadata (id + title). Never quote paid clause text.
- Fees only if present in EVIDENCE — "BIS FAQ figure — re-check the live FAQ".
- Use THIS query only. Do not reuse a product or IS from any earlier message.
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

function xaiKeys(): string[] {
  const primary = process.env.XAI_API_KEY?.trim() || "";
  const secondary = process.env.XAI_API_KEY_2?.trim() || "";
  const keys: string[] = [];
  if (isUsableKey(primary)) keys.push(primary);
  if (isUsableKey(secondary) && secondary !== primary) keys.push(secondary);
  return keys;
}

function isUsableKey(key: string): boolean {
  if (key.length < 20) return false;
  const lower = key.toLowerCase();
  return !["dummy", "placeholder", "changeme", "your-key", "xxx"].some((bad) =>
    lower.includes(bad),
  );
}

function xaiModels(): string[] {
  const preferred = process.env.XAI_MODEL?.trim();
  const list = [preferred, "grok-4.5", "grok-3-mini", "grok-3"].filter(
    (m): m is string => Boolean(m),
  );
  return [...new Set(list)];
}

function geminiKeys(): string[] {
  const list = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ]
    .map((k) => k?.trim() || "")
    .filter(Boolean);
  return [...new Set(list)];
}

function geminiModels(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const list = [
    preferred,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
  ].filter((m): m is string => Boolean(m));
  return [...new Set(list)];
}

async function streamXaiMessages(
  query: string,
  _language: AppLang,
  system: string,
  fallbackText: string,
  temperature = 0.1,
  maxTokens = 900,
  imageDataUrl?: string,
): Promise<Response> {
  const keys = xaiKeys();
  const text = query.slice(0, 8000);
  const userContent = imageDataUrl
    ? [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : text;
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: userContent },
  ];

  let lastDetail = "";
  for (const apiKey of keys) {
    for (const model of xaiModels()) {
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
            messages,
          }),
          signal: AbortSignal.timeout(28_000),
        });
      } catch (error) {
        lastDetail = error instanceof Error ? error.message : String(error);
        console.error("[chat] xAI threw:", lastDetail);
        continue;
      }
      if (!res.ok || !res.body) {
        lastDetail = await res.text().catch(() => "");
        console.error(`[chat] xAI ${res.status} model=${model}:`, lastDetail.slice(0, 400));
        const authOrCredits =
          res.status === 401 ||
          res.status === 403 ||
          /invalid api key|incorrect api key|permission-denied|spending limit|used all available credits/i.test(
            lastDetail,
          );
        if (authOrCredits) break;
        continue;
      }
      console.info(`[chat] xAI streaming model=${model}`);
      return pipeXaiSse(res, fallbackText);
    }
  }

  const gemini = await tryGeminiStream(query, system, fallbackText, temperature, maxTokens, imageDataUrl);
  if (gemini) return gemini;

  if (!keys.length) {
    console.warn("[chat] no XAI_API_KEY / Gemini key — pack fallback");
  } else {
    console.error("[chat] all LLM attempts failed — pack fallback", lastDetail.slice(0, 200));
  }
  return streamText(fallbackText);
}

async function tryGeminiStream(
  query: string,
  system: string,
  fallbackText: string,
  temperature: number,
  maxTokens: number,
  imageDataUrl?: string,
): Promise<Response | null> {
  const keys = geminiKeys();
  if (!keys.length) return null;
  const text = query.slice(0, 8000);
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [{ text }];
  if (imageDataUrl) {
    const b64 = imageDataUrl.replace(/^data:image\/png;base64,/i, "");
    parts.push({ inline_data: { mime_type: "image/png", data: b64 } });
  }
  let lastDetail = "";
  for (const apiKey of keys) {
    for (const model of geminiModels()) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(12_000),
        });
      } catch (error) {
        lastDetail = error instanceof Error ? error.message : String(error);
        console.error("[chat] Gemini threw:", lastDetail);
        continue;
      }
      if (!res.ok || !res.body) {
        lastDetail = await res.text().catch(() => "");
        console.error(`[chat] Gemini ${res.status} model=${model}:`, lastDetail.slice(0, 400));
        continue;
      }
      console.info(`[chat] Gemini streaming model=${model}`);
      return pipeGeminiSse(res, fallbackText);
    }
  }
  console.error("[chat] Gemini attempts failed", lastDetail.slice(0, 200));
  return null;
}

function pipeGeminiSse(res: Response, fallbackText: string): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
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
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
              };
              const text = json.candidates?.[0]?.content?.parts
                ?.map((p) => p.text || "")
                .join("");
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
          console.error("[chat] Gemini empty stream — pack fallback");
          controller.enqueue(encoder.encode(fallback));
        }
        controller.close();
      } catch (error) {
        console.error("[chat] Gemini stream failed:", error instanceof Error ? error.message : error);
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

function pipeXaiSse(res: Response, fallbackText: string): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
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
          query = typeof body.query === "string" ? body.query : "";
          language = isAppLang(body.language) ? body.language : "en";
          const parsed = parseAttachment(body.attachment);
          if (!parsed.ok) {
            return new Response(parsed.error, {
              status: 400,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
          const attachment: ReadyAttachment | null = parsed.attachment;
          if (!query.trim() && !attachment) {
            return new Response(
              UI_DICTIONARY[language].emptyQuery,
              { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
            );
          }
          const prompt = modelPrompt(query, attachment);
          const intent = classifyIntent(query);
          const retrievalQuery = retrievalText(query, attachment);
          const guided = !attachment ? moreReply(query, language) : null;
          const guidedKind = !attachment ? moreKind(query) : null;
          // HUID, hallmark, complaint and contact stay exact cards.
          // Standards and certification are phrased by the model from the same pack.
          const guidedStays =
            guidedKind === "huid" ||
            guidedKind === "hallmark" ||
            guidedKind === "complaint" ||
            guidedKind === "contact";
          if (guided && guidedStays) return streamText(guided);
          const schemeMix = !attachment && isHallmarkSchemeMix(query);
          if (!attachment && !schemeMix && deskKind(query)) {
            return streamText(deskReply(query, language) || "");
          }
          if (!attachment && intent === "social") {
            return streamXaiMessages(
              query,
              language,
              SOCIAL_PROMPT(language),
              socialReply(language),
              0.4,
              500,
            );
          }
          if (!attachment && intent === "offtopic") {
            return streamText(offtopicReply(language));
          }
          const { retrieveHybrid, formatEvidenceBlock } = await import("@/lib/retrieve");
          const { getFallbackBISResponse } = await import("@/lib/bisKnowledge");
          const retrieved = await retrieveHybrid(retrievalQuery);
          const pack = (guided && !guidedStays ? guided : null) || getFallbackBISResponse(retrievalQuery, language);
          const image = attachment?.kind === "png" ? attachment.dataUrl : undefined;
          console.info(`[chat] retrieval evidence=${retrieved.hasEvidence} hits=${retrieved.hits.length} confidence=${retrieved.confidence} mode=${retrieved.mode} file=${attachment?.kind ?? "none"}`);
          const evidence = retrieved.hasEvidence
            ? formatEvidenceBlock(retrieved)
            : "GROUNDING: refuse\nNO VERIFIED HITS in the local BIS catalogue for this query.\nYou MUST refuse to invent IS numbers, fees, or mandatory status.\nPoint the user to Know Your Standard: https://standards.bis.gov.in/website/know-your-standards";
          return streamXaiMessages(
            prompt,
            language,
            SYSTEM_PROMPT(language, evidence, retrieved.confidence, retrieved.mode),
            pack,
            0.25,
            1600,
            image,
          );
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
