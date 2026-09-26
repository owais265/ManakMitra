'use client';

import { useState, useSyncExternalStore } from 'react';
import { ArrowUpRight } from 'lucide-react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { deskUi, localFactLabel, localOfficial, localVerdictTitle } from '@/lib/desk-ui';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';
import { readinessSheet, type ReadinessSheet } from '@/lib/readiness';

export default function ReadinessPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const t = deskUi(lang);
  const [query, setQuery] = useState('');
  const [licence, setLicence] = useState('');
  const [sheet, setSheet] = useState<ReadinessSheet | null>(null);
  const [copied, setCopied] = useState(false);

  const run = () => {
    setCopied(false);
    setSheet(readinessSheet(query, licence));
  };

  const copySheet = async () => {
    if (!sheet) return;
    const lines = [
      localVerdictTitle(lang, sheet.verdict),
      sheet.verdict.scheme ? `${t.scheme}: ${sheet.verdict.scheme}` : '',
      sheet.related.length ? `${t.family}: ${sheet.related.join(', ')}` : '',
      sheet.stated.length ? `${t.wrote}: ${sheet.stated.map((fact) => `${localFactLabel(lang, fact.label)} ${fact.value}`).join('; ')}` : '',
      ...sheet.open.map((line) => `- ${line}`),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-4 text-center sm:px-6 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bis-navy dark:text-blue-300">{t.fileEyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">
            {t.fileH1}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            {t.fileLede}
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <form
            className="rounded-[1.75rem] border border-line bg-white p-5 mm-lift sm:p-6 dark:border-slate-700 dark:bg-[#151d30]"
            onSubmit={(event) => {
              event.preventDefault();
              run();
            }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{t.product}</h2>
              <span className="text-xs text-slate-500">{query.length}/400</span>
            </div>
            <textarea
              value={query}
              maxLength={400}
              rows={5}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.bulbPh}
              className="mt-3 w-full resize-none rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base leading-relaxed outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
            />
            <label className="mt-4 block text-sm font-medium">
              {t.licenceLabel}
              <input
                value={licence}
                onChange={(event) => setLicence(event.target.value)}
                placeholder="CM/L-1234567"
                className="mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]"
              />
            </label>
            <button
              type="submit"
              disabled={query.trim().length < 2}
              className="mt-5 inline-flex min-h-12 items-center rounded-full bg-bis-navy px-6 text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep disabled:bg-slate-300"
            >
              {t.makeSheet}
            </button>
          </form>

          <div>
            {!sheet ? (
              <div className="flex min-h-72 items-center rounded-3xl border border-dashed border-slate-300 px-6 text-sm leading-relaxed text-slate-500">
                {t.fileEmpty}
              </div>
            ) : (
              <article className="rounded-[1.75rem] border border-line bg-white p-5 mm-drop sm:p-6 dark:border-slate-700 dark:bg-[#151d30]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-navy dark:text-blue-300">{t.pinned}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{localVerdictTitle(lang, sheet.verdict)}</h2>
                {sheet.verdict.scheme ? <p className="mt-1 text-sm font-medium text-bis-navy dark:text-blue-300">{t.scheme}: {sheet.verdict.scheme}</p> : null}
                <p className="mt-2 text-xs font-semibold text-amber-700">{t.notScore}</p>

                {sheet.related.length ? (
                  <section className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t.family}</h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {sheet.related.map((mark) => (
                        <li key={mark} className="rounded-full border border-current/40 bg-current/[0.08] px-3 py-1 text-sm font-medium text-current">{mark}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {sheet.stated.length ? (
                  <section className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t.wrote}</h3>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {sheet.stated.map((fact) => (
                        <li key={fact.label} className="rounded-2xl border border-line px-3 py-2 text-sm dark:border-slate-700">
                          <span className="block text-xs text-slate-500">{localFactLabel(lang, fact.label)}</span>
                          <span className="font-medium">{fact.value}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t.stillOpen}</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                    {!sheet.licence ? <li>• {t.noLicence}</li> : sheet.licence.status === 'format-ok' ? <li>• {sheet.licence.marks[0]} {t.shapeOk}</li> : <li>• {t.shapeBad}</li>}
                    <li>• {t.noPercent}</li>
                  </ul>
                </section>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={sheet.verdict.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-bis-navy px-4 text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep">
                    {localOfficial(lang, sheet.verdict.officialLabel)}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a
                    href={`/labs?product=${encodeURIComponent(query.slice(0, 80))}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold mm-press hover:border-bis-navy dark:border-slate-600"
                  >
                    {t.findLab}
                  </a>
                  <button type="button" onClick={() => void copySheet()} className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold mm-press hover:border-bis-navy dark:border-slate-600">
                    {copied ? t.copied : t.copyFile}
                  </button>
                </div>
              </article>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
