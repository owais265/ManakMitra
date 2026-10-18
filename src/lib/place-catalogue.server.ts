import { getServiceSupabase } from "@/lib/supabase.server";
import {
  BIS_LABS,
  OTHER_LABS,
  NEAR_KM,
  haversineKm,
  pinCentroid,
  publishedAddress,
  publishedPin,
  type RankedLab,
} from "@/lib/labs";
import { citySpot } from "@/lib/city-spots";
import { recognisedLabRows, searchPackTitles } from "@/lib/rag";
import closedCentres from "@/data/ahc-closed.json";

type PlaceKind = "lab" | "hallmark";

type Place = {
  id: string;
  name: string;
  address: string;
  pin: string;
  url: string;
  lat: number;
  lng: number;
  city: string;
  tier: "bis-own" | "bis-recognised" | "closed";
};

let labCache: Place[] | null = null;

function cityOf(body: string): string {
  const match = body.match(/City\s+([^.]*)\./i);
  return (match?.[1] || "").trim();
}

function stateOf(body: string): string {
  const match = body.match(/State\s+([^.]*)\./i);
  return (match?.[1] || "").trim();
}

function localLabs(): Place[] {
  if (labCache) return labCache;
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const row of recognisedLabRows()) {
    const city = cityOf(row.body);
    const spot = citySpot(city);
    if (!city || !spot) continue;
    const key = row.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    const state = stateOf(row.body);
    places.push({
      id: `lab-${places.length}-${spot.label}`,
      name: row.title.slice(0, 160),
      address: [city, state].filter(Boolean).join(", "),
      pin: "",
      url: row.url,
      lat: spot.lat,
      lng: spot.lng,
      city: spot.label,
      tier: "bis-recognised",
    });
  }
  labCache = places;
  return places;
}

let closedCache: Place[] | null = null;

function closedHallmarkPlaces(): Place[] {
  if (closedCache) return closedCache;
  closedCache = (closedCentres as { name: string; pin: string; status: string }[]).flatMap((row, index) => {
    const spot = pinCentroid(row.pin);
    if (!spot) return [];
    const status = row.status === "suspended" ? "suspended" : "cancelled";
    return [
      {
        id: `ahc-${index}-${row.pin}`,
        name: row.name,
        address: `${spot.label} ${row.pin} · ${status} in the 10 Oct 2026 extract. Not an open centre.`,
        pin: row.pin,
        url: "https://huid.manakonline.in/MANAK/HallmarkingHomePage",
        lat: spot.lat,
        lng: spot.lng,
        city: spot.label,
        tier: "closed" as const,
      },
    ];
  });
  return closedCache;
}

function rankRows(rows: Place[], origin: { lat: number; lng: number }, product = ""): RankedLab[] {
  const needle = product.trim().toLowerCase();
  return rows
    .map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      city: place.city,
      pin: place.pin,
      phone: "",
      email: "",
      lat: place.lat,
      lng: place.lng,
      confidence: place.tier === "bis-own" ? ("high" as const) : ("low" as const),
      km: Math.round(haversineKm(origin.lat, origin.lng, place.lat, place.lng) * 10) / 10,
      productHit: needle.length > 2 && `${place.name} ${place.address}`.toLowerCase().includes(needle),
      url: place.url,
      tier: place.tier,
    }))
    .sort((a, b) => Number(b.productHit) - Number(a.productHit) || a.km - b.km || a.name.localeCompare(b.name));
}

async function remotePlaces(kind: PlaceKind, origin: { lat: number; lng: number }, product: string): Promise<RankedLab[]> {
  const sb = getServiceSupabase();
  if (!sb || kind !== "lab") return [];
  const places: Place[] = [];
  const seen = new Set<string>();
  for (let from = 0; from < 2000; from += 1000) {
    const { data, error } = await sb.from("pack_docs").select("title,text,url").eq("kind", kind).range(from, from + 999);
    if (error || !data?.length) break;
    for (const row of data as { title?: string; text?: string; url?: string }[]) {
      const title = (row.title || "").trim();
      const text = row.text || "";
      const pin = publishedPin(text);
      const spot = pin ? pinCentroid(pin) : null;
      if (!title || !pin || !spot) continue;
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        id: `remote-${places.length}-${pin}`,
        name: title.slice(0, 160),
        address: publishedAddress(text) || `${spot.label} ${pin}`,
        pin,
        url: (row.url || "").trim(),
        lat: spot.lat,
        lng: spot.lng,
        city: spot.label,
        tier: "bis-recognised",
      });
    }
    if (data.length < 1000) break;
  }
  return rankRows(places, origin, product);
}

/** Local pack first. Supabase only adds lab rows the pack does not already name. */
export async function rankPublishedPlaces(
  kind: PlaceKind,
  origin: { lat: number; lng: number },
  _userPin = "",
  product = "",
): Promise<RankedLab[]> {
  if (kind === "hallmark") return rankRows(closedHallmarkPlaces(), origin, product);
  const local = rankRows(localLabs(), origin, product);
  if (local.length) return local;
  return remotePlaces(kind, origin, product);
}

const FIELD_KINDS = {
  standard: ["standard"],
  product: ["product"],
  verify: ["standard", "product"],
  file: ["product"],
  process: ["process", "crs"],
  hallmark: ["hallmark"],
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
  const token = fieldToken(query).replace(/[%_,]/g, " ").trim();
  const local = token.length >= 3 ? searchPackTitles(token, field, 6) : [];
  if (local.length) return local;
  const sb = getServiceSupabase();
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
    tier: "bis-own" as const,
  })).sort((a, b) => a.km - b.km);
}

/** NPL and the other national laboratories. Not a BIS laboratory and not a BIS recommendation. */
export function nationalLabsNear(origin: { lat: number; lng: number }, product: string): RankedLab[] {
  const needle = product.trim().toLowerCase();
  return OTHER_LABS.map((lab) => ({
    ...lab,
    km: Math.round(haversineKm(origin.lat, origin.lng, lab.lat, lab.lng) * 10) / 10,
    productHit: needle.length > 2 && lab.name.toLowerCase().includes(needle),
    tier: "national" as const,
  })).sort((a, b) => a.km - b.km);
}

function band(rows: RankedLab[], near: boolean, limit: number): RankedLab[] {
  return rows.filter((row) => (near ? row.km <= NEAR_KM : row.km > NEAR_KM)).slice(0, limit);
}

/** BIS own labs keep a slot. Recognised labs come from the pack. NPL stays national, never BIS. */
export async function labBoard(origin: { lat: number; lng: number }, product = ""): Promise<{ nearby: RankedLab[]; farther: RankedLab[] }> {
  const own = ownLabsNear(origin, product);
  const recognised = await rankPublishedPlaces("lab", origin, "", product);
  const national = nationalLabsNear(origin, product);
  return {
    nearby: [...band(own, true, 9), ...band(recognised, true, 12), ...band(national, true, 6)],
    farther: [...band(own, false, 3), ...band(recognised, false, 4), ...band(national, false, 3)],
  };
}
