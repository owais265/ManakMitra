import { chatHardCard, deskKind, isCaseBrief } from "./desk-route.ts";
import { classifyIntent } from "./intent.ts";
import { moreKind, type MoreKind } from "./more-desk.ts";

/** One specialist per turn. The model never picks a second tool. */
export type DeskAgent = MoreKind | "verify" | "file" | "labs" | "social" | "refuse" | "retrieve";

export type AgentPlan = {
  agent: DeskAgent;
  tools: 1;
  injection: boolean;
};

const OVERRIDE =
  /ignore (all |any )?(previous|prior|above) (instructions|rules|prompts?)|disregard (the |your )?(rules|system)|you are now|jailbreak|reveal (the |your )?(api key|secret|system prompt)/gi;

const FORGE =
  /\b(?:do not refuse|don't refuse|ignore (?:the |your |all )?(?:rules|instructions)|you are now\b|jailbreak|disregard (?:the |your )?(?:rules|system))\b|\b(?:invent|print|make up)\b[\s\S]{0,80}\b(?:is[\s./-]*\d+|fee|rupee|₹|official)\b/i;

export const FORGE_LINE =
  "This desk will not invent an IS number, a fee, or a rule exception. A number that is not in the pack stays not in the pack.";

export function forgeAsk(query: string): boolean {
  return FORGE.test(query);
}

export function planDeskAgent(query: string, hasAttachment = false): AgentPlan {
  const injection = OVERRIDE.test(query);
  OVERRIDE.lastIndex = 0;
  const text = query.replace(OVERRIDE, " ").replace(/\s+/g, " ").trim();
  OVERRIDE.lastIndex = 0;
  if (!text) return { agent: "refuse", tools: 1, injection };
  if (injection && text.split(/\s+/).length < 3) return { agent: "refuse", tools: 1, injection: true };
  if (hasAttachment) return { agent: "retrieve", tools: 1, injection };
  if (isCaseBrief(query)) {
    const desk = deskKind(query);
    return { agent: desk || "retrieve", tools: 1, injection };
  }
  const hard = chatHardCard(text);
  if (hard === "file") return { agent: "file", tools: 1, injection };
  if (hard === "licence") return { agent: "verify", tools: 1, injection };
  const desk = deskKind(text);
  if (desk) return { agent: desk, tools: 1, injection };
  const guided = moreKind(text);
  if (guided) return { agent: guided, tools: 1, injection };
  const intent = classifyIntent(text);
  if (intent === "social") return { agent: "social", tools: 1, injection };
  if (intent === "offtopic") return { agent: "refuse", tools: 1, injection };
  return { agent: "retrieve", tools: 1, injection };
}
