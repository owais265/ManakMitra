import { createFileRoute } from "@tanstack/react-router";
import { classifyIntent, offtopicReply, socialReply } from "@/lib/intent";
import { chatHardCard, deskKind, deskReply, labsFinderResult } from "@/lib/desk-route";
import { pinCentroid } from "@/lib/labs";
import { labBoard, searchField, type PackField } from "@/lib/place-catalogue.server";
import { checkHuid, huidToken, moreKind, moreReply } from "@/lib/more-desk";
import { isHallmarkSchemeMix, matchProductFamily, shouldClarify } from "@/lib/product-playbook";
import { isFollowCue, followRetrieval, type ChatTurn } from "@/lib/query-context";
import { isAppLang, langPromptName, UI_DICTIONARY, type AppLang } from "@/lib/language";
import { modelPrompt, parseAttachment, retrievalText, type ReadyAttachment } from "@/lib/attachments";
import { buildStops } from "@/lib/work-trace";
import { chatLog } from "@/lib/chat-log";
import { fetchOnceRetry } from "@/lib/http-retry";
import { env } from "@/lib/env.server";
import { clientIp, takeLimit } from "@/lib/rate-limit";
import { cacheGet, cacheSet, retrievalCacheKey } from "@/lib/retrieval-cache";
import { guardSpoken } from "@/lib/answer-guard";

type ChatBody = {
  query?: string;
  language?: AppLang;
  attachment?: unknown;
  history?: ChatTurn[];
  labelText?: string;
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
- If MATCH is no, say in one line that this catalogue has no row, then give the official link. Do not invent a nearer answer.
- If MATCH is yes, you MUST answer from the ranked hits. Never say there is no evidence, no verified hit, or insufficient evidence when hits are listed.

GOLDEN RULE:
- Answer ONLY using EVIDENCE. Do not invent IS numbers, fees, dates, clauses, or QCO status.
- Refuse an IS number, fee, clause, or lab accreditation ONLY when MATCH is no.
- Catalogue rows are metadata (id + title). Never quote paid clause text.
- Fees only if present in EVIDENCE — "BIS FAQ figure — re-check the live FAQ".
- Use the current question. Carry a product forward only when a FOLLOW-UP SUBJECT line names one. Never invent a second product.
- If EVIDENCE has a disambiguation NOTE, ask that ONE question in a normal sentence. Do not assume gold 22K/916, a helmet type, a pipe material, or jeweller-vs-consumer. Do not emit [PROCESS_STEPS] until they specify.
- Labs: names in EVIDENCE only. Confirm live scope on BIS LIMS. Never "accredited for IS X".
- How to apply / ISI / CRS / FMCS: numbered 4–6 steps from process rows + the full host https://www.manakonline.in or https://www.crsbis.in from EVIDENCE, not a search engine. Never write akonline.in.
- CONSUMER hallmark / HUID / CARE / verify gold: [PROCESS_STEPS] = BIS CARE Verify HUID only. FORBIDDEN: Apply online as jeweller, Submit with no docs/fee, Get instant registration, Sell only AHC-hallmarked pieces.
- JEWELLER / AHC / hallmark licence: hallmarking registration process rows only.
- Not a tender/procurement engine.

EVIDENCE:
${evidence}

Suggested confidence: ${confidence}
Suggested contextMode: ${mode}
Copy that confidence into [META]. Do not write low when the suggested confidence is high or medium.

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

function pickSpoken(modelText: string, fallback: string): string {
  const spoken = modelText.trim();
  const head = fallback.split("\n")[0] || "";
  const fallbackReal =
    head.length > 12 &&
    !/not enough verified|NO VERIFIED|could not load the BIS/i.test(fallback.slice(0, 240));
  const falseRefuse =
    /no verified hits|not enough verified|insufficient evidence|catalogue has no row|no matching row|do not have enough/i.test(
      spoken.slice(0, 500),
    );
  if (fallbackReal && (!spoken || falseRefuse)) return fallback;
  return spoken || fallback;
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

async function answerText(
  query: string,
  _language: AppLang,
  system: string,
  fallbackText: string,
  temperature = 0.1,
  maxTokens = 900,
  imageDataUrl?: string,
): Promise<string> {
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
        res = await fetchOnceRetry(
          (ms) =>
            fetch("https://api.x.ai/v1/chat/completions", {
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
              signal: AbortSignal.timeout(ms),
            }),
          28_000,
        );
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
      return collectXai(res, fallbackText);
    }
  }

  const gemini = await tryGeminiText(query, system, fallbackText, temperature, maxTokens, imageDataUrl);
  if (gemini) return gemini;

  if (!keys.length) {
    console.warn("[chat] no XAI_API_KEY / Gemini key — pack fallback");
  } else {
    console.error("[chat] all LLM attempts failed — pack fallback", lastDetail.slice(0, 200));
  }
  return fallbackText;
}

async function tryGeminiText(
  query: string,
  system: string,
  fallbackText: string,
  temperature: number,
  maxTokens: number,
  imageDataUrl?: string,
): Promise<string | null> {
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      let res: Response;
      try {
        res = await fetchOnceRetry(
          (ms) =>
            fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts }],
                generationConfig: { temperature, maxOutputTokens: maxTokens },
              }),
              signal: AbortSignal.timeout(ms),
            }),
          12_000,
        );
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
      return collectGemini(res, fallbackText);
    }
  }
  console.error("[chat] Gemini attempts failed", lastDetail.slice(0, 200));
  return null;
}

async function collectGemini(res: Response, fallbackText: string): Promise<string> {
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
  let buffer = "";
  let spoken = "";
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
          const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
          if (text) spoken += text;
        } catch {
          // skip malformed SSE
        }
      }
    }
    if (!spoken.trim()) console.error("[chat] Gemini empty stream — pack fallback");
    return pickSpoken(spoken, fallbackText);
  } catch (error) {
    console.error("[chat] Gemini stream failed:", error instanceof Error ? error.message : error);
    return spoken.trim() ? pickSpoken(spoken, fallbackText) : fallbackText;
  }
}

async function collectXai(res: Response, fallbackText: string): Promise<string> {
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
  let buffer = "";
  let spoken = "";
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
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const text = json.choices?.[0]?.delta?.content;
          if (text) spoken += text;
        } catch {
          // skip malformed SSE
        }
      }
    }
    if (!spoken.trim()) console.error("[chat] xAI empty stream — pack fallback");
    return pickSpoken(spoken, fallbackText);
  } catch (error) {
    console.error("[chat] xAI stream failed:", error instanceof Error ? error.message : error);
    return spoken.trim() ? pickSpoken(spoken, fallbackText) : fallbackText;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const reqId = crypto.randomUUID();
        const started = performance.now();
        const waHeader = request.headers.get("x-manak-wa");
        const waPass = env("WHATSAPP_VERIFY_TOKEN");
        const fromWa = Boolean(waPass && waHeader === waPass);
        const gate = fromWa ? { ok: true as const } : takeLimit(`chat:${clientIp(request)}`);
        if (!gate.ok) {
          chatLog({
            id: reqId,
            desk: "chat",
            path: "-",
            cache: "skip",
            limited: "yes",
            refuse: "rate",
            ms: Math.round(performance.now() - started),
          });
          return new Response("Too many requests.", {
            status: 429,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Retry-After": String(gate.retryAfter),
            },
          });
        }
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
          const labelText = typeof body.labelText === "string" ? body.labelText.replace(/\s+/g, " ").trim().slice(0, 500) : "";
          const sentLabel = Object.prototype.hasOwnProperty.call(body, "labelText");
          const history = Array.isArray(body.history) ? body.history : [];
          const headers = {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          };
          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              const say = (text: string) => {
                if (text) controller.enqueue(encoder.encode(text));
              };
              const step = (id: string, label: string, detail: string, t0: number) => {
                const payload = JSON.stringify({
                  kind: "step",
                  step: {
                    id,
                    label,
                    detail: detail.slice(0, 220),
                    ms: Math.max(0, Math.round(performance.now() - t0)),
                  },
                });
                say(`[WORK]${payload}\n`);
              };
              try {
                let t = performance.now();
                let followSubject = "";
                const slotted = !attachment && isFollowCue(query) ? followRetrieval(query, history) : query.trim();
                if (slotted !== query.trim()) {
                  const cue = query.trim();
                  followSubject = slotted.endsWith(cue) ? slotted.slice(0, slotted.length - cue.length).trim() : slotted;
                }
                const gateQuery = [followSubject, query].filter(Boolean).join(" ");
                const intent = classifyIntent(query);
                step(
                  "read",
                  "Read the question",
                  intent === "bis" ? "Indian Standards question" : intent === "social" ? "Greeting" : "Outside Indian Standards",
                  t,
                );
                if (attachment && attachment.kind !== "text" && sentLabel && !labelText && !query.trim()) {
                  t = performance.now();
                  step("label", "Read the label", "The label could not be read", t);
                  say("The label could not be read. No licence number was extracted. Type the number printed with the mark.");
                  return;
                }
                const hard = !attachment ? chatHardCard(query) : null;
                if (hard) {
                  t = performance.now();
                  const card = deskReply(query, language) || "";
                  const hits = await searchField(query, hard === "file" ? "file" : "verify");
                  step("desk", "Opened the desk card", hits.length ? `${hits.length} loaded rows` : "No title match", t);
                  const lines = hits.map((hit) => `- ${hit.title}${hit.url ? ` — ${hit.url}` : ""}`);
                  say([card, lines.length ? "Loaded rows for this field. Not a licence grant." : "", ...lines].filter(Boolean).join("\n"));
                  return;
                }
                const desk = !attachment ? deskKind(query) : null;
                const guidedKind = !attachment ? moreKind(query) : null;
                if (!attachment && !followSubject && !desk && !guidedKind && intent === "social") {
                  t = performance.now();
                  const spoken = await answerText(query, language, SOCIAL_PROMPT(language), socialReply(language), 0.4, 500);
                  step("reply", "Answered the greeting", "No catalogue search", t);
                  say(spoken);
                  return;
                }
                if (!attachment && !followSubject && intent === "offtopic") {
                  t = performance.now();
                  step("refuse", "Refused", "Outside Indian Standards", t);
                  chatLog({
                    id: reqId,
                    desk: "chat",
                    path: "refuse",
                    cache: "skip",
                    limited: "no",
                    refuse: "offtopic",
                    ms: Math.round(performance.now() - started),
                  });
                  say(offtopicReply(language));
                  return;
                }
                if (!attachment && isHallmarkSchemeMix(gateQuery)) {
                  t = performance.now();
                  step("refuse", "Refused", "Hallmark does not apply", t);
                  chatLog({
                    id: reqId,
                    desk: "chat",
                    path: "refuse",
                    cache: "skip",
                    limited: "no",
                    refuse: "scheme",
                    ms: Math.round(performance.now() - started),
                  });
                  say("Hallmark and HUID do not apply to this product. Use the ISI or CRS desk, not jewellery verification. https://www.bis.gov.in");
                  return;
                }
                t = performance.now();
                const family = matchProductFamily(query);
                const schemeDetail = isHallmarkSchemeMix(query)
                  ? "Hallmark does not apply"
                  : family?.scheme
                    ? String(family.scheme)
                    : "No scheme pinned";
                step("scheme", "Checked the scheme", schemeDetail, t);
                const typed = query.trim() ? retrievalText(query, attachment) : "";
                const retrievalQuery = [followSubject, typed, labelText].filter(Boolean).join("\n").slice(0, 500);
                const { retrieveHybrid, formatEvidenceBlock } = await import("@/lib/retrieve");
                const { getFallbackBISResponse } = await import("@/lib/bisKnowledge");
                t = performance.now();
                const deskName = desk || guidedKind || "chat";
                const cacheKey = retrievalCacheKey(deskName, retrievalQuery);
                const bust = request.headers.get("x-cache-bust");
                let cacheFlag = "miss";
                let retrieved = bust ? null : cacheGet(cacheKey);
                if (retrieved) cacheFlag = "hit";
                if (!retrieved) {
                  retrieved = await retrieveHybrid(retrievalQuery);
                  if (!bust) cacheSet(cacheKey, retrieved);
                }
                const locked = (retrieved.hits[0]?.score ?? 0) >= 0.45;
                chatLog({
                  id: reqId,
                  desk: deskName,
                  path: locked ? "lock" : "extras",
                  cache: cacheFlag,
                  limited: "no",
                  refuse: retrieved.hasEvidence ? "-" : "no-row",
                  ms: Math.round(performance.now() - started),
                });
                step(
                  "search",
                  "Searched the catalogue",
                  `${cacheFlag} · ${retrieved.hits.length} rows · ${retrieved.mode} · ${retrieved.grounding}${labelText ? " · label text included" : ""}`,
                  t,
                );
                t = performance.now();
                const official = retrieved.hits.some((hit) => hit.url);
                step(
                  "evidence",
                  "Checked the source",
                  official ? "An official page is on a row" : "No official row",
                  t,
                );
                say(`[WORK]${JSON.stringify({ kind: "graph", stops: buildStops(`${query}\n${labelText}`, retrieved) })}\n`);
                t = performance.now();
                const missing = shouldClarify(`${query}\n${labelText}`);
                const exitDetail = missing
                  ? "Clarify — one fact is missing"
                  : !retrieved.hasEvidence
                    ? "Refuse — no pack row"
                    : retrieved.grounding === "refuse"
                      ? "Refuse — a limit applies"
                      : "Allow — sourced row";
                step("exit", "Chose the exit", exitDetail, t);
                const guided = !attachment ? moreReply(query, language) : null;
                const pack = guided || getFallbackBISResponse(retrievalQuery, language);
                const image = attachment?.kind === "png" ? attachment.dataUrl : undefined;
                console.info(`[chat] retrieval evidence=${retrieved.hasEvidence} hits=${retrieved.hits.length} confidence=${retrieved.confidence} mode=${retrieved.mode} follow=${followSubject || "-"} file=${attachment?.kind ?? "none"}`);
                let evidence = retrieved.hasEvidence
                  ? formatEvidenceBlock(retrieved)
                  : "MATCH: no\nNO VERIFIED HITS in the local BIS catalogue for this query.\nYou MUST say the catalogue has no row. Do not invent an IS number, fee, or mandatory status.\nPoint the user to Know Your Standard: https://standards.bis.gov.in/website/know-your-standards";
                if (labelText) {
                  evidence += `\n\nLABEL TEXT READ IN THE BROWSER: ${labelText}\nUse a number from this label only when that same number is in the ranked hits. If it is not, say the photo text is not in this pack.`;
                }
                if (followSubject) {
                  evidence = `FOLLOW-UP SUBJECT: ${followSubject}\nThe user already named this. Answer the new question about it. Do not switch products.\n\n${evidence}`;
                }
                if (!attachment && deskKind(query) === "labs") {
                  const board = labsFinderResult(query);
                  const facts = deskReply(query, language) || "";
                  evidence += `\n\nLAB BOARD (names and kilometres only from here; do not invent a closer lab): ${board ? "map will show beside this reply." : "no pin yet."}\n${facts}`;
                  const pin = query.match(/(?<!\d)([1-9]\d{5})(?!\d)/)?.[1] || "";
                  const origin = pin ? pinCentroid(pin) : board?.origin || null;
                  if (origin) {
                    const placed = await labBoard(origin, "");
                    const own = placed.nearby.filter((lab) => lab.tier === "bis-own").slice(0, 3);
                    const recognised = [...placed.nearby, ...placed.farther].filter((lab) => lab.tier === "bis-recognised").slice(0, 6);
                    const national = placed.nearby.filter((lab) => lab.tier === "national").slice(0, 3);
                    if (own.length) {
                      evidence +=
                        "\n\nBIS LABORATORIES (BIS own). Do not call a national laboratory a BIS laboratory.\n" +
                        own.map((lab) => `- ${lab.name} | ${lab.city} | ${lab.km} km`).join("\n");
                    }
                    if (recognised.length) {
                      evidence +=
                        "\n\nRECOGNISED LABS from the loaded extract. City centre, not a surveyed gate. Call these BIS recognised. Do not claim a test scope.\n" +
                        recognised.map((lab) => `- ${lab.name} | ${lab.city} | ${lab.km} km`).join("\n");
                    }
                    if (national.length) {
                      evidence +=
                        "\n\nNATIONAL LABORATORIES including NPL. Not a BIS laboratory and not a recommendation.\n" +
                        national.map((lab) => `- ${lab.name} | ${lab.city} | ${lab.km} km`).join("\n");
                    }
                  }
                }
                const field: PackField | null =
                  guidedKind === "standards" ? "standard" : guidedKind === "certify" ? "process" : desk === "verify" ? "verify" : null;
                const trusted: string[] = retrieved.hits.map(
                  (hit) => `${hit.title}\n${hit.body}\n${hit.url}`,
                );
                if (field) {
                  const hits = await searchField(query, field);
                  if (hits.length) {
                    trusted.push(...hits.map((hit) => `${hit.title}\n${hit.url ?? ""}`));
                    evidence +=
                      "\n\nFIELD ROWS from the loaded extract for this desk only. Quote a title only if it is listed. Do not treat a title match as a licence.\n" +
                      hits.map((hit) => `- ${hit.title}${hit.url ? ` | ${hit.url}` : ""}`).join("\n");
                  }
                }
                const code = huidToken(query);
                if (code) {
                  const shape = checkHuid(query);
                  evidence += `\n\nHUID SHAPE: ${shape.code} is ${shape.status === "ok" ? "a 6-character shape" : "not a valid 6-character HUID"}. This is not the BIS CARE register. Do not say pass, fail, or genuine.`;
                }
                if (!attachment && isHallmarkSchemeMix(query)) {
                  evidence += "\n\nSCHEME: Hallmark and HUID do not apply to this product. Say that first. Point to ISI or CRS, not jewellery verification.";
                }
                const userPrompt = labelText
                  ? `${modelPrompt(query, attachment)}\n\nLABEL TEXT READ IN THE BROWSER:\n${labelText}`
                  : modelPrompt(query, attachment);
                t = performance.now();
                const spoken = guardSpoken(
                  await answerText(
                    userPrompt,
                    language,
                    SYSTEM_PROMPT(language, evidence, retrieved.confidence, retrieved.mode),
                    pack,
                    0.25,
                    1600,
                    image,
                  ),
                  trusted.join("\n"),
                  pack,
                );
                step("write", "Wrote the answer", "From the rows above", t);
                const unreadLabel = Boolean(attachment && attachment.kind !== "text" && sentLabel && !labelText);
                say(unreadLabel ? `The label could not be read. No licence number was extracted.\n\n${spoken}` : spoken);
              } catch (error) {
                console.error("[chat] stream failed:", error instanceof Error ? error.message : error);
                say(UI_DICTIONARY[language].catalogueLoadError);
              } finally {
                controller.close();
              }
            },
          });
          return new Response(stream, { headers });
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
