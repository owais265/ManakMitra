declare module "@/data/rag-pack.json" {
  const value: {
    verified: string;
    vocab: string[];
    idf: number[];
    docs: { i: number[]; v: number[] }[];
    chunks: { id: string; kind: string; title: string; body: string; url: string }[];
    catalogue?: { id: string; kind: string; title: string; body: string; url: string }[];
  };
  export default value;
}
