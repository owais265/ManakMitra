export type Metal = "gold" | "silver" | "platinum";

export type FinenessMark = {
  metal: Metal;
  fineness: string;
  karat: string;
  aliases: string[];
};

/** Published BIS jewellery grades. Re-check the live hallmarking list before you buy or label. */
export const FINENESS: FinenessMark[] = [
  { metal: "gold", fineness: "995", karat: "24K", aliases: ["995", "24k", "24kt", "24carat", "24c"] },
  { metal: "gold", fineness: "958", karat: "23K", aliases: ["958", "23k", "23kt", "23carat"] },
  { metal: "gold", fineness: "916", karat: "22K", aliases: ["916", "22k", "22kt", "22carat", "22ct"] },
  { metal: "gold", fineness: "875", karat: "21K", aliases: ["875", "21k", "21kt"] },
  { metal: "gold", fineness: "833", karat: "20K", aliases: ["833", "20k", "20kt"] },
  { metal: "gold", fineness: "750", karat: "18K", aliases: ["750", "18k", "18kt", "18carat"] },
  { metal: "gold", fineness: "585", karat: "14K", aliases: ["585", "14k", "14kt"] },
  { metal: "gold", fineness: "375", karat: "9K", aliases: ["375", "9k", "9kt", "9carat"] },
  { metal: "silver", fineness: "999", karat: "999", aliases: ["999", "fine silver", "silver999"] },
  { metal: "silver", fineness: "970", karat: "970", aliases: ["970"] },
  { metal: "silver", fineness: "925", karat: "925", aliases: ["925", "sterling"] },
  { metal: "silver", fineness: "900", karat: "900", aliases: ["900"] },
  { metal: "silver", fineness: "835", karat: "835", aliases: ["835"] },
  { metal: "silver", fineness: "800", karat: "800", aliases: ["800"] },
  { metal: "platinum", fineness: "950", karat: "950", aliases: ["950", "pt950"] },
  { metal: "platinum", fineness: "900", karat: "900", aliases: ["pt900"] },
  { metal: "platinum", fineness: "850", karat: "850", aliases: ["850", "pt850"] },
];

const METAL_WORD: Record<Metal, RegExp> = {
  gold: /gold|सोना|सोने|সোনা|தங்கம்|బంగార|सोनं|સોન|ಚಿನ್ನ|സ്വർണ|ਸੋਨਾ|سونا|ସୁନା/i,
  silver: /silver|चाँदी|चांदी|রুপো|வெள்ளி|వెండి|चांदी|ચાંદી|ಬೆಳ್ಳಿ|വെള്ളി|ਚਾਂਦੀ|چاندی|ରୂପା/i,
  platinum: /platinum|प्लेटिनम|প্লাটিনাম|பிளாட்டினம்/i,
};

function norm(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function findFineness(query: string): FinenessMark[] {
  const raw = query.normalize("NFKC").trim();
  if (raw.length < 2) return [];
  const q = norm(raw);
  const byNumber = FINENESS.filter((mark) => {
    const karat = norm(mark.karat);
    return (
      q === mark.fineness ||
      q === karat ||
      q.endsWith(mark.fineness) ||
      mark.aliases.some((alias) => norm(alias) === q || q.endsWith(norm(alias)))
    );
  });
  if (byNumber.length) {
    const metal = (Object.keys(METAL_WORD) as Metal[]).find((name) => METAL_WORD[name].test(raw));
    if (metal) {
      const narrowed = byNumber.filter((mark) => mark.metal === metal);
      if (narrowed.length) return narrowed;
    }
    return byNumber;
  }
  const metal = (Object.keys(METAL_WORD) as Metal[]).find((name) => METAL_WORD[name].test(raw));
  if (metal && raw.length < 40) return FINENESS.filter((mark) => mark.metal === metal);
  return [];
}

export function wantsHallmarkParts(query: string): boolean {
  return /parts? of (a |the )?hallmark|hallmark (parts|marks|consist)|what is on (a |the )?hallmark|हॉलमार्क में क्या|হলমার্কে কী/i.test(
    query,
  );
}
