export type EvidenceHit = {
  kind: "standard" | "product" | "process" | "lab" | "hallmark" | "crs" | "faq" | "consumer" | "link";
  title: string;
  body: string;
  url: string;
  score: number;
};

export type Retrieval = {
  query: string;
  hits: EvidenceHit[];
  mode: "standards" | "hallmarking" | "general";
  confidence: "high" | "medium" | "low";
  hasEvidence: boolean;
};
