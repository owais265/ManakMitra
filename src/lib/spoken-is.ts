const DIGIT: Record<string, string> = {};

function mapDigits(chars: string) {
  for (let i = 0; i < chars.length; i++) DIGIT[chars[i]] = String(i);
}

mapDigits("०१२३४५६७८९");
mapDigits("০১২৩৪৫৬৭৮৯");
mapDigits("௦௧௨௩௪௫௬௭௮௯");
mapDigits("౦౧౨౩౪౫౬౭౮౯");
mapDigits("૦૧૨૩૪૫૬૭૮૯");
mapDigits("೦೧೨೩೪೫೬೭೮೯");
mapDigits("൦൧൨൩൪൫൬൭൮൯");
mapDigits("੦੧੨੩੪੫੬੭੮੯");
mapDigits("୦୧୨୩୪୫୬୭୮୯");
mapDigits("٠١٢٣٤٥٦٧٨٩");

/** Turn a spoken standard into the form the pack already matches. */
export function foldSpokenQuery(raw: string): string {
  let text = "";
  for (const ch of raw) text += DIGIT[ch] ?? ch;
  const spoken = [
    /\bI[\s.]*S\b(?=\s*\d)/gi,
    /आई[\s.]*एस/g,
    /ஐ[\s.]*எஸ்/g,
    /ఐ[\s.]*ఎస్/g,
    /আই[\s.]*এস/g,
    /ಐ[\s.]*ಎಸ್/g,
    /ഐ[\s.]*എസ്/g,
    /ਆਈ[\s.]*ਐਸ/g,
    /ଆଇ[\s.]*ଏସ/g,
    /آئی[\s.]*ایس/g,
  ];
  for (const re of spoken) text = text.replace(re, "IS");
  text = text.replace(/बी[\s.]*आई[\s.]*एस/g, "BIS");
  const typos: Array<[RegExp, string]> = [
    [/\bcemenet\b/gi, "cement"],
    [/\bcemnet\b/gi, "cement"],
    [/\bcemant\b/gi, "cement"],
    [/\bsiment\b/gi, "cement"],
    [/\bportlant\b/gi, "portland"],
    [/\bhelmate\b/gi, "helmet"],
    [/\bhelmat\b/gi, "helmet"],
    [/\bhelmt\b/gi, "helmet"],
    [/\bstandrd\b/gi, "standard"],
    [/\bstandart\b/gi, "standard"],
    [/\blabortory\b/gi, "laboratory"],
    [/\blaboratry\b/gi, "laboratory"],
    [/\blaboratroy\b/gi, "laboratory"],
    [/\blisence\b/gi, "licence"],
    [/\blicnce\b/gi, "licence"],
    [/\bhardning\b/gi, "hardening"],
    [/\bcertifcation\b/gi, "certification"],
    [/\bhallmak\b/gi, "hallmark"],
    [/\bjewellry\b/gi, "jewellery"],
  ];
  for (const [re, word] of typos) text = text.replace(re, word);
  return text.replace(/[ \t]{2,}/g, " ");
}
