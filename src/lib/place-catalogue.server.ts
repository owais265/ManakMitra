import { getServiceSupabase } from "@/lib/supabase.server";
import {
  BIS_LABS,
  haversineKm,
  pinCentroid,
  publishedAddress,
  publishedPin,
  type RankedLab,
} from "@/lib/labs";

type PlaceKind = "lab" | "hallmark";

type Place = {
  id: string;
  name: string;
  address: string;
  pin: string;
  url: string;
  deferred: boolean;
};

let cache: { at: number; lab: Place[]; hallmark: Place[] } | null = null;

function keep(kind: PlaceKind, title: string, text: string): boolean {
  if (/^\(deferred\)/i.test(title)) return false;
  if (kind === "hallmark") {
    if (/^\d/.test(title)) return false;
    if (/extraordinary|gazette|regd\. no/i.test(text.slice(0, 240))) return false;
  }
  return true;
}

async function load(kind: PlaceKind): Promise<Place[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  const places: Place[] = [];
  const seen = new Set<string>();
  for (let from = 0; from < 8000; from += 1000) {
    const { data, error } = await sb
      .from("pack_docs")
      .select("title,text,url")
      .eq("kind", kind)
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const row of data as { title?: string; text?: string; url?: string }[]) {
      const title = (row.title || "").trim();
      const text = row.text || "";
      const pin = publishedPin(text);
      if (!title || !pin || !keep(kind, title, text)) continue;
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        id: `${kind}-${places.length}-${pin}`,
        name: title.slice(0, 160),
        address: publishedAddress(text) || title.slice(0, 180),
        pin,
        url: (row.url || "").trim(),
        deferred: /^\(deferred\)/i.test(title),
      });
    }
    if (data.length < 1000) break;
  }
  return places;
}

async function places(kind: PlaceKind): Promise<Place[]> {
  if (!cache || Date.now() - cache.at > 10 * 60 * 1000) {
    const [lab, hallmark] = await Promise.all([load("lab"), load("hallmark")]);
    cache = { at: Date.now(), lab, hallmark };
  }
  return kind === "lab" ? cache.lab : cache.hallmark;
}

/** Rank published LIMS labs or hallmarking centres by their own PIN. No invented street GPS. */
export async function rankPublishedPlaces(
  kind: PlaceKind,
  origin: { lat: number; lng: number },
  userPin = "",
  product = "",
): Promise<RankedLab[]> {
  const needle = product.trim().toLowerCase();
  const rows = await places(kind);
  const ranked = rows.map((place) => {
    const spot = pinCentroid(place.pin) ?? { lat: origin.lat, lng: origin.lng, label: place.pin };
    const same3 = userPin.length === 6 && place.pin.slice(0, 3) === userPin.slice(0, 3);
    const km = same3 && place.pin === userPin ? 0 : Math.round(haversineKm(origin.lat, origin.lng, spot.lat, spot.lng) * 10) / 10;
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      city: spot.label,
      pin: place.pin,
      phone: "",
      email: "",
      lat: spot.lat,
      lng: spot.lng,
      confidence: "low" as const,
      km,
      productHit: needle.length > 2 && `${place.name} ${place.address}`.toLowerCase().includes(needle),
      url: place.url,
    };
  });
  ranked.sort((a, b) => Number(b.productHit) - Number(a.productHit) || a.km - b.km || a.name.localeCompare(b.name));
  return ranked;
}

const FIELD_KINDS = {
  standard: ["standard"],
  product: ["product"],
  verify: ["standard", "product"],
  file: ["product"],
  process: ["process", "crs"],
} as const;

export type PackField = keyof typeof FIELD_KINDS;

const STOP = new Set([
  "product", "products", "standard", "standards", "indian", "certification", "process",
  "verify", "check", "file", "files", "what", "this", "that", "with", "from", "have",
  "does", "scheme", "about", "please", "find", "show", "tell",
]);

/** A short title needle. An IS number wins. A short phrase is kept whole. */
export function fieldToken(query: string): string {
  const raw = query.trim().slice(0, 80);
  const is = raw.match(/\bIS[\s/.:-]*(\d{2,5})\b/i);
  if (is) return is[1];
  const words = raw.match(/[A-Za-z][A-Za-z0-9-]{3,}/g) || [];
  const kept = words.filter((word) => !STOP.has(word.toLowerCase()));
  if (kept.length >= 1 && kept.length <= 4 && raw.length <= 48 && !/^(what|which|how|is|are|do|does|can|kya)\b/i.test(raw)) {
    return kept.join(" ");
  }
  kept.sort((a, b) => b.length - a.length);
  return (kept[0] || "").slice(0, 40);
}

export async function searchField(query: string, field: PackField): Promise<{ title: string; url: string }[]> {
  const sb = getServiceSupabase();
  const token = fieldToken(query).replace(/[%_,]/g, " ").trim();
  if (!sb || token.length < 3) return [];
  const { data, error } = await sb
    .from("pack_docs")
    .select("title,url")
    .in("kind", [...FIELD_KINDS[field]])
    .ilike("title", `%${token}%`)
    .limit(6);
  if (error || !data) return [];
  const seen = new Set<string>();
  const hits: { title: string; url: string }[] = [];
  for (const row of data as { title?: string; url?: string }[]) {
    const title = (row.title || "").trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    hits.push({ title: title.slice(0, 180), url: (row.url || "").trim() });
  }
  return hits;
}

export async function searchProductTitles(query: string): Promise<{ title: string; url: string }[]> {
  return searchField(query, "verify");
}

export function ownLabsNear(origin: { lat: number; lng: number }, product: string): RankedLab[] {
  const needle = product.trim().toLowerCase();
  return BIS_LABS.map((lab) => ({
    ...lab,
    km: Math.round(haversineKm(origin.lat, origin.lng, lab.lat, lab.lng) * 10) / 10,
    productHit: needle.length > 2 && lab.name.toLowerCase().includes(needle),
  })).sort((a, b) => a.km - b.km);
}
