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
        const nearPublished = published.filter((place) => place.km <= NEAR_KM).slice(0, 12);
        const own = kind === "lab" ? ownLabsNear(origin, product).filter((lab) => lab.km <= NEAR_KM) : [];
        const nearby = nearPublished.length ? [...own, ...nearPublished] : rankLabs(origin.lat, origin.lng, product).filter((lab) => lab.km <= NEAR_KM);
        const farther = nearPublished.length
          ? published.filter((place) => place.km > NEAR_KM).slice(0, 4)
          : rankLabs(origin.lat, origin.lng, product).filter((lab) => lab.km > NEAR_KM).slice(0, 4);
        return Response.json({
          origin,
          source,
          product,
          kind,
          nearby,
          farther,
          mapUrl: areaMapUrl(origin.lat, origin.lng, origin.label, product),
          note: nearPublished.length
            ? kind === "hallmark"
              ? "Hallmarking centres are from the BIS extract already loaded. Distance uses the published PIN, not a surveyed gate. This list is not a live HUID check."
              : "Names and PINs are from the BIS LIMS extract already loaded. Distance uses that published PIN, not a surveyed gate. A BIS laboratory with a published address is marked high."
            : kind === "hallmark"
              ? "No hallmarking centre from the loaded extract sits within 80 km of this PIN."
              : "No laboratory from the loaded LIMS extract sits within 80 km. The list below is BIS own laboratories only. NPL, NTH, CIPET and other non-BIS labs are not ranked. The map still shows what Google lists around this PIN.",
        });
      },
    },
  },
});
