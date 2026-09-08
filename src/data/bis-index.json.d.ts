declare module "@/data/bis-index.json" {
  const value: {
    standards: { id: string; title: string; kw: string; url: string }[];
    products: Record<string, string>[];
    process: Record<string, string>[];
    labs: { name: string; type: string; id: string; city: string; state: string; url: string }[];
    hallmark: Record<string, string>[];
    crs: { sl: number; is_no: string; product: string; category: string }[];
    crs_meta: Record<string, string>[];
    faqs: Record<string, string>[];
    links: Record<string, string>[];
    consumer: Record<string, string>[];
    verified: string;
  };
  export default value;
}
