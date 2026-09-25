import { createFileRoute } from "@tanstack/react-router";
import { areaMapUrl, NEAR_KM, pinCentroid, rankLabs } from "@/lib/labs";

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
        let body: { pin?: unknown; lat?: unknown; lng?: unknown; product?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const product = typeof body.product === "string" ? body.product.slice(0, 80) : "";
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
        const labs = rankLabs(origin.lat, origin.lng, product);
        const nearby = labs.filter((lab) => lab.km <= NEAR_KM);
        return Response.json({
          origin,
          source,
          product,
          nearby,
          farther: labs.filter((lab) => lab.km > NEAR_KM).slice(0, 4),
          mapUrl: areaMapUrl(origin.lat, origin.lng, origin.label, product),
          note: nearby.length
            ? "High means a BIS laboratory with a published address. Low means a real laboratory whose pin is only the city. The map is Google’s own listing for this place."
            : "No laboratory in this desk sits within 80 km. The distances below are real. The map still shows what Google lists around this PIN.",
        });
      },
    },
  },
});
