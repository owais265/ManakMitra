export type HuidStatus =
  | "empty"
  | "ok"
  | "licence"
  | "crs"
  | "short"
  | "long"
  | "digits"
  | "letters"
  | "blocked"
  | "bad";

export type HuidCheck = { status: HuidStatus; code: string };

const HINDI = "०१२३४५६७८९";
const BLOCK =
  /^(HUID|FAN|MARK|TEST|FAKE|GOLD|TOY|CEM|ISI|BIS|LAB|PIPE|BULB|SOAP|MILK|CARE|HALL|NULL|NONE|XXXX|AAAA|CEMENT|HELMET)/;

/** Jewellery HUID is 6 characters, letters and numbers together. Not a live register. */
export function checkHuid(raw: string): HuidCheck {
  let text = raw.normalize("NFKC").trim().slice(0, 48);
  text = text.replace(/[०-९]/g, (d) => String(HINDI.indexOf(d)));
  text = text.toUpperCase().replace(/[\s._]+/g, "");
  if (!text) return { status: "empty", code: "" };

  const compact = text.replace(/-/g, "");
  if (/^CM\/?L-?\d{6,8}$/.test(text) || /^CML\d{6,8}$/.test(compact)) {
    return { status: "licence", code: text.replace(/^CML(?=\d)/, "CM/L-").replace(/^CM\/L(?=\d)/, "CM/L-") };
  }
  if (/^R-?\d{6,12}$/.test(compact)) {
    const digits = compact.replace(/^R/, "");
    return { status: "crs", code: `R-${digits}` };
  }

  const code = compact.replace(/[^A-Z0-9]/g, "");
  if (!code) return { status: "bad", code: text };
  if (code.length < 6) return { status: "short", code };
  if (code.length > 6) return { status: "long", code };
  if (BLOCK.test(code)) return { status: "blocked", code };
  if (!/[A-Z]/.test(code)) return { status: "digits", code };
  if (!/\d/.test(code)) return { status: "letters", code };
  if (!/^[A-Z0-9]{6}$/.test(code)) return { status: "bad", code };
  return { status: "ok", code };
}

/** Pull the code a person is asking about out of a sentence. */
export function extractHuid(query: string): string {
  const labelled = query.match(
    /(?:huid|ह्यूइड|ह्यूआईडी|हालमार्क\s*कोड)\s*[:#\-]?\s*([A-Za-z0-9०-९.\-_/]{4,20})/i,
  );
  if (labelled?.[1]) return labelled[1];
  const tokens = query.match(/[A-Za-z0-9०-९][A-Za-z0-9०-९./-]{3,20}/g) || [];
  let fallback = "";
  for (const token of tokens) {
    const hit = checkHuid(token);
    if (hit.status === "ok" || hit.status === "licence" || hit.status === "crs" || hit.status === "blocked") {
      return token;
    }
    if (!fallback && hit.status !== "empty" && hit.status !== "bad") fallback = token;
  }
  return fallback || query.trim().slice(0, 48);
}
