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
  return text.replace(/[ \t]{2,}/g, " ");
}
