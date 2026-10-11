declare module "@/data/rag-pack.json" {
  const value: {
    verified: string;
    verifiedAt?: string;
    vocab: string[];
    idf: number[];
    docs: { i: number[]; v: number[] }[];
    chunks: {
      id: string;
      kind: string;
      title: string;
      body: string;
      url: string;
      scheme: string | null;
      family: string | null;
      group_name: string | null;
    }[];
    catalogue?: {
      id: string;
      kind: string;
      title: string;
      body: string;
      url: string;
      scheme: string | null;
      family: string | null;
      group_name: string | null;
    }[];
  };
  export default value;
}
