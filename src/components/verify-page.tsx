'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Camera, Hash, Search } from 'lucide-react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { parseAttachment } from '@/lib/attachments';
import { deskUi, localOfficial, localVerdictTitle } from '@/lib/desk-ui';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';
import type { VerifyMode, VerifyVerdict } from '@/lib/verify-cert';

const CHOICES: { id: VerifyMode; icon: typeof Hash }[] = [
  { id: 'licence', icon: Hash },
  { id: 'photo', icon: Camera },
  { id: 'brand', icon: Search },
];

const STATUS_KEY = {
  invalid: 'noneNote',
  'format-ok': 'highNote',
  'brand-hit': 'lowNote',
  unclear: 'unclear1',
  'not-found': 'miss1',
  unreadable: 'noneNote',
} as const;

export default function VerifyPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const t = deskUi(lang);
  const [mode, setMode] = useState<VerifyMode | null>(null);
  const [query, setQuery] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerifyVerdict | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const choose = (next: VerifyMode) => {
    setMode(next);
    setVerdict(null);
    setError(null);
    setQuery('');
    setFileName(null);
    setDataUrl(null);
  };

  const submit = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          query,
          attachment: mode === 'photo' && dataUrl ? { name: fileName || 'mark.jpg', kind: 'image', dataUrl } : undefined,
        }),
      });
      const json = (await response.json()) as VerifyVerdict & { error?: string };
      if (!response.ok) {
        setError(t.errCheck);
        return;
      }
      setVerdict(json);
    } catch {
      setError(t.errRetry);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-4 text-center sm:px-6 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bis-navy dark:text-blue-300">{t.verifyEyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">
            {t.verifyH1}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            {t.verifyLede}
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="#check"
              className="inline-flex min-h-14 items-center rounded-full bg-bis-navy px-8 text-base font-semibold text-white mm-press hover:bg-bis-navy-deep sm:min-h-16 sm:px-10 sm:text-lg"
            >
              {t.startCheck}
            </a>
          </div>
        </section>

        <section id="check" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="grid gap-3">
            {CHOICES.map((choice) => {
              const Icon = choice.icon;
              const on = mode === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => choose(choice.id)}
                  className={`flex w-full items-start gap-4 rounded-[1.5rem] border bg-white px-4 py-4 text-left mm-lift ${on ? 'border-bis-navy dark:border-blue-400 dark:bg-[#151d30]' : 'border-line hover:border-bis-navy/40 dark:border-slate-700 dark:bg-[#10182a]'}`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${on ? 'text-bis-navy dark:text-blue-300' : 'text-slate-400'}`} />
                  <span>
                    <span className="block text-base font-semibold text-slate-900 dark:text-slate-50">
                      {choice.id === 'licence' ? t.licenceTitle : choice.id === 'photo' ? t.photoTitle : t.brandTitle}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {choice.id === 'licence' ? t.licenceLine : choice.id === 'photo' ? t.photoLine : t.brandLine}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {mode ? (
            <form
              className="mt-8 rounded-[1.75rem] border border-line bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-[#151d30]"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {mode === 'licence' ? (
                <label className="block text-sm font-medium">
                  {t.numberLabel}
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="CM/L-1234567"
                    className="mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
                  />
                </label>
              ) : null}

              {mode === 'brand' ? (
                <label className="block text-sm font-medium">
                  {t.brandLabel}
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t.brandPh}
                    className="mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
                  />
                </label>
              ) : null}

              {mode === 'photo' ? (
                <div>
                  <p className="text-sm font-medium">{t.photoLabel}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.photoHelp}</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    className="sr-only"
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = '';
                      if (!picked) return;
                      void (async () => {
                        const url = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result || ''));
                          reader.onerror = () => reject(new Error('read'));
                          reader.readAsDataURL(picked);
                        });
                        const parsed = parseAttachment({ name: picked.name, kind: 'image', dataUrl: url });
                        if (!parsed.ok || parsed.attachment?.kind !== 'image') {
                          setError(t.errPhoto);
                          setDataUrl(null);
                          setFileName(null);
                          return;
                        }
                        setError(null);
                        setDataUrl(parsed.attachment.dataUrl);
                        setFileName(parsed.attachment.name);
                      })();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-medium mm-press hover:border-bis-navy dark:border-slate-600"
                  >
                    <Camera className="h-4 w-4" />
                    {fileName || t.upload}
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy || (mode === 'photo' ? !dataUrl : query.trim().length < 2)}
                className="mt-6 inline-flex min-h-12 items-center rounded-full bg-bis-navy px-6 text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {busy ? t.checking : t.check}
              </button>
              {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
            </form>
          ) : null}

          {verdict ? (
            <article className="mt-8 rounded-[1.75rem] border border-line bg-white p-5 mm-drop sm:p-8 dark:border-slate-700 dark:bg-[#151d30]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{t[STATUS_KEY[verdict.status]]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{localVerdictTitle(lang, verdict)}</h2>
              {verdict.scheme ? <p className="mt-3 text-sm font-semibold text-bis-navy dark:text-blue-300">{t.scheme}: {verdict.scheme}</p> : null}
              {verdict.marks.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {verdict.marks.map((mark) => (
                    <li key={mark} className="rounded-full border border-current/40 bg-current/[0.08] px-3 py-1 text-sm font-medium text-current">{mark}</li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {verdict.status === 'format-ok' && verdict.scheme === 'ISI · Scheme-I' ? <li>• {t.isiShape}</li> : null}
                {verdict.status === 'format-ok' && verdict.scheme === 'CRS · Scheme-II' ? <li>• {t.crsShape}</li> : null}
                {verdict.status === 'format-ok' && verdict.scheme === 'Hallmark · HUID' ? <li>• {t.huidShape}</li> : null}
                {verdict.status === 'brand-hit' ? <li>• {t.hit1}</li> : null}
                {verdict.status === 'brand-hit' ? <li>• {t.hit2}</li> : null}
                {verdict.status === 'unclear' ? <li>• {t.unclear1}</li> : null}
                {verdict.status === 'not-found' || verdict.status === 'invalid' ? <li>• {t.miss1}</li> : null}
                <li>• {t.noPercent}</li>
              </ul>
              <a
                href={verdict.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 items-center gap-1 rounded-full bg-bis-navy px-4 text-sm font-semibold text-white mm-press"
              >
                {localOfficial(lang, verdict.officialLabel)}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </article>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
