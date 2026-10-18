import { createFileRoute } from "@tanstack/react-router";
import { areaMapUrl, NEAR_KM, pinCentroid } from "@/lib/labs";
import { labBoard, rankPublishedPlaces, searchField, type PackField } from "@/lib/place-catalogue.server";
import { searchPackTitles } from "@/lib/rag";
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
        const pinDigits = typeof body.pin === "string" ? body.pin.replace(/\D/g, "") : "";
        const hasPin = /^[1-9][0-9]{5}$/.test(pinDigits);
        const latIn = typeof body.lat === "number" ? body.lat : Number.NaN;
        const lngIn = typeof body.lng === "number" ? body.lng : Number.NaN;
        const hasDevice = Number.isFinite(latIn) && Number.isFinite(lngIn);
        const fieldKind = kind === "standard" || kind === "product" || kind === "verify" || kind === "file" || kind === "process" || kind === "hallmark";
        if (fieldKind && !(kind === "hallmark" && (hasPin || hasDevice))) {
          const q = typeof body.q === "string" ? body.q : product;
          const hits = await searchField(q, kind as PackField);
          return Response.json({ hits });
        }
        const lat = latIn;
        const lng = lngIn;
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
        const userPin = hasPin ? pinDigits : "";
        if (placeKind === "hallmark") {
          const published = await rankPublishedPlaces("hallmark", origin, userPin, product);
          const marks = searchPackTitles("hallmark", "hallmark", 4);
          return Response.json({
            origin,
            source,
            product,
            kind,
            nearby: published.filter((place) => place.km <= NEAR_KM).slice(0, 12),
            farther: published.filter((place) => place.km > NEAR_KM).slice(0, 8),
            marks,
            mapUrl: areaMapUrl(origin.lat, origin.lng, origin.label, product),
            note: "Closed or suspended centres from the 10 Oct 2026 extract are not open. The hallmark marks below are from the loaded pack. This is not a live HUID check. Confirm on BIS CARE.",
          });
        }
        const board = await labBoard(origin, product);
        return Response.json({
          origin,
          source,
          product,
          kind,
          nearby: board.nearby,
          farther: board.farther,
          mapUrl: areaMapUrl(origin.lat, origin.lng, origin.label, product),
          note: board.nearby.some((lab) => lab.tier === "bis-recognised" || lab.tier === "bis-own")
            ? "BIS laboratory is a BIS own laboratory. BIS recognised is a Group-1 row from the loaded extract. National laboratory, including NPL, is not a BIS laboratory and not a recommendation. Distance is the city centre, not a surveyed gate. A product name is not a test scope."
            : "No laboratory from the loaded extract could be placed. BIS own laboratories are still listed. National laboratories are not a BIS recommendation.",
        });
      },
    },
  },
});
