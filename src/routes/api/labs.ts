import { createFileRoute } from "@tanstack/react-router";
import { areaMapUrl, NEAR_KM, pinCentroid, rankLabs } from "@/lib/labs";
import { ownLabsNear, rankPublishedPlaces, searchField, type PackField } from "@/lib/place-catalogue.server";
import { chatLog } from "@/lib/chat-log";
import { clientIp, takeLimit } from "@/lib/rate-limit";

async function geocodePin(pin: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const fallback = pinCentroid(pin);
  try {
    const postal = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(4000) });
    const rows = (await postal.json()) as { Status?: string; PostOffice?: { Name?: string; District?: string; State?: string }[] }[];
    const office = rows?.[0]?.Status === "Success" ? rows[0].PostOffice?.[0] : undefined;
    const label = [office?.Name, office?.District, office?.State].filter(Boolean).join(", ") || fallback?.label || pin;
    if (office?.District && office.State) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(`${office.District}, ${office.State}, ${pin}, India`)}`;
      const geo = await fetch(url, {
        headers: { "User-Agent": "ManakMitra/1.0 (BIS lab distance)" },
        signal: AbortSignal.timeout(4000),
      });
      const hits = (await geo.json()) as { lat?: string; lon?: string }[];
      const lat = Number(hits?.[0]?.lat);
      const lng = Number(hits?.[0]?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, label };
    }
    return fallback ? { ...fallback, label } : null;
  } catch {
    return fallback;
  }
}

export const Route = createFileRoute("/api/labs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = performance.now();
        const gate = takeLimit(`labs:${clientIp(request)}`);
        if (!gate.ok) {
          chatLog({
            id: crypto.randomUUID(),
            desk: "labs",
            path: "-",
            cache: "skip",
            limited: "yes",
            refuse: "rate",
            ms: Math.round(performance.now() - started),
          });
          return Response.json(
            { error: "Too many requests." },
            { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
          );
        }
        let body: { pin?: unknown; lat?: unknown; lng?: unknown; product?: unknown; kind?: unknown; q?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const product = typeof body.product === "string" ? body.product.slice(0, 80) : "";
        const kind = typeof body.kind === "string" ? body.kind : "lab";
        if (kind === "standard" || kind === "product" || kind === "verify" || kind === "file" || kind === "process") {
          const q = typeof body.q === "string" ? body.q : product;
          const hits = await searchField(q, kind as PackField);
          return Response.json({ hits });
        }
        const lat = typeof body.lat === "number" ? body.lat : Number.NaN;
        const lng = typeof body.lng === "number" ? body.lng : Number.NaN;
        let origin: { lat: number; lng: number; label: string } | null = null;
        let source: "device" | "pin" = "pin";
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          origin = { lat, lng, label: "This device" };
          source = "device";
        } else if (typeof body.pin === "string") {
          const pin = body.pin.replace(/\D/g, "");
          if (!/^[1-9][0-9]{5}$/.test(pin)) {
            return Response.json({ error: "Enter a 6-digit PIN code, or use this device's location." }, { status: 400 });
          }
          origin = await geocodePin(pin);
        }
        if (!origin) {
          return Response.json({ error: "Enter a 6-digit PIN code, or use this device's location." }, { status: 400 });
        }
        const placeKind = kind === "hallmark" ? "hallmark" : "lab";
        const userPin = typeof body.pin === "string" && /^[1-9][0-9]{5}$/.test(body.pin.replace(/\D/g, "")) ? body.pin.replace(/\D/g, "") : "";
        const published = await rankPublishedPlaces(placeKind, origin, userPin, product);
        const own = kind === "lab" ? ownLabsNear(origin, product) : [];
        const seen = new Set<string>();
        const merged = [...own, ...published].filter((lab) => {
          const key = lab.name.toLowerCase().slice(0, 80);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        merged.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name));
        const nearby = merged.filter((lab) => lab.km <= NEAR_KM).slice(0, 20);
        const farther = merged.filter((lab) => lab.km > NEAR_KM).slice(0, 8);
        const usedFallback = kind === "lab" && !published.length;
        const shownNear = usedFallback ? rankLabs(origin.lat, origin.lng, product).filter((lab) => lab.km <= NEAR_KM) : nearby;
        const shownFar = usedFallback ? rankLabs(origin.lat, origin.lng, product).filter((lab) => lab.km > NEAR_KM).slice(0, 8) : farther;
        return Response.json({
          origin,
          source,
          product,
          kind,
          nearby: shownNear,
          farther: shownFar,
          mapUrl: areaMapUrl(origin.lat, origin.lng, origin.label, product),
          note:
            kind === "hallmark"
              ? "This PIN list is the 10 Oct 2026 cancelled and suspended centre extract. It is not an open-centre finder and not a live HUID check. Confirm on BIS CARE."
              : published.length
                ? "BIS laboratory means a BIS own laboratory. BIS recognised means a Group-1 laboratory from the loaded extract. Distance is the city centre, not a surveyed gate. A product name does not mean that laboratory is accredited for that IS. Confirm scope on LIMS."
                : "No laboratory from the loaded extract could be placed. The list below is BIS own laboratories only.",
        });
      },
    },
  },
});
