'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { MapPin } from 'lucide-react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { deskUi } from '@/lib/desk-ui';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';
import { mapsEmbedUrl, mapsSearchUrl, type RankedLab } from '@/lib/labs';

type Result = {
  origin: { lat: number; lng: number; label: string };
  source: 'device' | 'pin';
  product: string;
  nearby: RankedLab[];
  farther: RankedLab[];
  mapUrl: string;
  note: string;
};

export default function LabsPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const t = deskUi(lang);
  const [pin, setPin] = useState('');
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<RankedLab | null>(null);

  useEffect(() => {
    const productFromLink = new URLSearchParams(window.location.search).get('product');
    if (productFromLink) setProduct(productFromLink.slice(0, 80));
  }, []);

  const search = async (coords?: { lat: number; lng: number }) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, product, lat: coords?.lat, lng: coords?.lng }),
      });
      const json = (await response.json()) as Result & { error?: string };
      if (!response.ok) {
        const digits = pin.replace(/\D/g, '');
        setError(!coords && !/^[1-9][0-9]{5}$/.test(digits) ? t.errPin : t.errLabs);
        return;
      }
      setResult(json);
      setSelected(null);
    } catch {
      setError(t.errLabs);
    } finally {
      setBusy(false);
    }
  };

  const useDevice = () => {
    if (!navigator.geolocation) {
      setError(t.errNoGeo);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void search({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy(false);
        setError(t.errGeoDenied);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-4 text-center sm:px-6 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bis-navy dark:text-blue-300">{t.labsEyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">
            {t.labsH1}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            {t.labsLede}
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr]">
          <form
            className="rounded-[1.75rem] border border-line bg-white p-5 dark:border-slate-700 dark:bg-[#151d30]"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <label className="block text-sm font-medium">
              {t.pinLabel}
              <input
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="492001"
                className="mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              {t.productLabel}
              <input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder={t.productPh}
                className="mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-bis-navy text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep disabled:bg-slate-300"
            >
              {busy ? t.finding : t.find}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={useDevice}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 text-sm font-semibold mm-press hover:border-bis-navy dark:border-slate-600"
            >
              <MapPin className="h-4 w-4" />
              {t.useDevice}
            </button>
            {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
            {result ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {t.fromPlace} {result.source === 'device' ? t.thisDevice : result.origin.label}. {result.nearby.length ? t.noteNear : t.noteFar}
              </p>
            ) : null}
          </form>

          <div>
            {result ? (
              <iframe
                key={selected ? `${selected.id}-${result.origin.lat}` : result.mapUrl}
                title={selected ? `Google Map of ${selected.name}` : `Google Map near ${result.origin.label}`}
                src={selected ? mapsEmbedUrl(selected, result.origin) : result.mapUrl}
                className="h-72 w-full rounded-[1.75rem] border border-line bg-white dark:border-slate-700 sm:h-80"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-slate-300 text-sm text-slate-500 sm:h-80">
                {t.mapEmpty}
              </div>
            )}
            {selected && result ? (
              <a href={mapsSearchUrl(selected)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-bis-navy dark:text-blue-300">
                {t.openMaps}
              </a>
            ) : null}

            {result ? (
              <div className="mt-4">
                <p className="text-xs leading-relaxed text-slate-500">{result.nearby.length ? t.noteNear : t.noteFar}</p>
                <LabList title={result.nearby.length ? t.within : t.nearNo} labs={result.nearby} selectedId={selected?.id} onPick={setSelected} bis={t.bisLab} city={t.cityList} maps={t.openMaps} />
                <LabList title={t.farther} labs={result.farther} selectedId={selected?.id} onPick={setSelected} bis={t.bisLab} city={t.cityList} maps={t.openMaps} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function LabList({
  title,
  labs,
  selectedId,
  onPick,
  bis,
  city,
  maps,
}: {
  title: string;
  labs: RankedLab[];
  selectedId?: string;
  onPick: (lab: RankedLab) => void;
  bis: string;
  city: string;
  maps: string;
}) {
  if (!labs.length) return null;
  return (
    <section className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      <ul className="mt-2 grid gap-2">
        {labs.map((lab) => (
          <li key={lab.id} className={`rounded-[1.25rem] border bg-white px-4 py-3 mm-lift dark:bg-[#151d30] ${selectedId === lab.id ? 'border-bis-navy' : 'border-line dark:border-slate-700'}`}>
            <button type="button" onClick={() => onPick(lab)} className="w-full text-left">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-ink dark:text-slate-50">{lab.name}</span>
                <span className="shrink-0 text-sm text-bis-navy dark:text-blue-300">{lab.km} km</span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{lab.address}</span>
              <span className={`mt-2 inline-flex text-xs font-semibold ${lab.confidence === 'high' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {lab.confidence === 'high' ? bis : city}
              </span>
            </button>
            <a href={mapsSearchUrl(lab)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-bis-navy dark:text-blue-300">
              {maps}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
