'use client';

import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight } from 'lucide-react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { deskUi, localVerdictTitle } from '@/lib/desk-ui';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';
import { moreCopy } from '@/lib/more-copy';
import {
  FINENESS,
  MORE_URL,
  checkHuid,
  findHallmark,
  gradeLine,
  metalWord,
  type CertScheme,
  type Fineness,
  type HuidCheck,
} from '@/lib/more-desk';
import { checkBrand } from '@/lib/verify-cert';

function DeskShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

function Hero({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-14 pb-4 text-center sm:px-6 sm:pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bis-navy dark:text-blue-300">{eyebrow}</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">{lede}</p>
    </section>
  );
}

function Steps({ lines }: { lines: string[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {lines.map((line, index) => (
        <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bis-navy text-xs font-semibold text-white">{index + 1}</span>
          <span className="pt-0.5">{line}</span>
        </li>
      ))}
    </ol>
  );
}

function OfficialLink({ href, label, className = 'mt-6' }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} inline-flex min-h-11 items-center gap-1 rounded-full bg-bis-navy px-4 text-sm font-semibold text-white mm-press`}
    >
      {label}
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

const field =
  'mt-2 w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-base outline-none focus:border-bis-navy dark:border-slate-600 dark:bg-[#151d30]';
const card = 'rounded-[1.75rem] border border-line bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-[#151d30]';
const submit =
  'mt-6 inline-flex min-h-12 items-center rounded-full bg-bis-navy px-6 text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep disabled:bg-slate-300 dark:disabled:bg-slate-700';

function fill(template: string, code: string): string {
  return template.replaceAll('{code}', code);
}

export function HuidPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = moreCopy(lang);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<HuidCheck | null>(null);

  const headline = !result
    ? ''
    : result.status === 'ok'
      ? fill(copy.huidOk, result.code)
      : result.status === 'licence'
        ? copy.huidLicence
        : result.status === 'bad'
          ? result.code
            ? `${copy.huidBad} (${result.code})`
            : copy.huidBad
          : copy.huidEmpty;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setResult(checkHuid(code));
  };

  return (
    <DeskShell>
      <Hero eyebrow={copy.huidEyebrow} title={copy.huidH1} lede={copy.huidLede} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <form className={card} onSubmit={onSubmit}>
          <label className="block text-sm font-medium">
            {copy.huidLabel}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={copy.huidPh}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              className={`${field} tracking-[0.18em]`}
            />
          </label>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.huidHelp}</p>
          <button type="submit" disabled={!code.trim()} className={submit}>
            {copy.check}
          </button>
        </form>
        {result ? (
          <article className={`mt-8 ${card} mm-drop`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{copy.notLive}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{headline}</h2>
            <Steps lines={copy.huidSteps} />
            <OfficialLink href={MORE_URL.huid} label={copy.openHuid} />
          </article>
        ) : (
          <div className="mt-8">
            <Steps lines={copy.huidSteps} />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{copy.notLive}</p>
            <OfficialLink href={MORE_URL.huid} label={copy.openHuid} />
          </div>
        )}
      </section>
    </DeskShell>
  );
}

export function HallmarkPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = moreCopy(lang);
  const [text, setText] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const found = asked && !pickedId ? findHallmark(text) : null;
  const picked = pickedId ? FINENESS.find((row) => row.id === pickedId) || null : found?.grade || null;
  const ambiguous = Boolean(found?.ambiguous900);
  const metals: Fineness['metal'][] = ['gold', 'silver', 'platinum'];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPickedId(null);
    setAsked(true);
  };

  const choose = (row: Fineness) => {
    setText(row.id === 'pt900' ? 'platinum 900' : row.tag);
    setPickedId(row.id);
    setAsked(true);
  };

  return (
    <DeskShell>
      <Hero eyebrow={copy.hmEyebrow} title={copy.hmH1} lede={copy.hmLede} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <form className={card} onSubmit={onSubmit}>
          <label className="block text-sm font-medium">
            {copy.hmLabel}
            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPickedId(null);
              }}
              placeholder={copy.hmPh}
              className={field}
            />
          </label>
          <div className="mt-5 space-y-4">
            {metals.map((metal) => (
              <div key={metal}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metalWord(copy, metal)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FINENESS.filter((row) => row.metal === metal).map((row) => {
                    const on = pickedId === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => choose(row)}
                        className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium mm-press ${
                          on
                            ? 'border-bis-navy bg-bis-navy text-white dark:border-blue-300'
                            : 'border-line bg-white text-slate-700 hover:border-bis-navy/40 dark:border-slate-600 dark:bg-[#10182a] dark:text-slate-100'
                        }`}
                      >
                        {row.tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button type="submit" disabled={!text.trim()} className={submit}>
            {copy.check}
          </button>
        </form>
        {asked ? (
          <article className={`mt-8 ${card} mm-drop`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{copy.notLive}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {picked ? gradeLine(copy, picked) : copy.hmMiss}
            </h2>
            {ambiguous ? <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{copy.both900}</p> : null}
            <Steps lines={copy.hmSteps} />
            <OfficialLink href={MORE_URL.huid} label={copy.openHuid} />
          </article>
        ) : (
          <div className="mt-8">
            <Steps lines={copy.hmSteps} />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{copy.notLive}</p>
          </div>
        )}
      </section>
    </DeskShell>
  );
}

export function StandardsPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = moreCopy(lang);
  const ui = deskUi(lang);
  const [name, setName] = useState('');
  const [asked, setAsked] = useState('');
  const verdict = asked ? checkBrand(asked) : null;
  const clarify = asked ? Boolean(verdict && verdict.status === 'unclear') : false;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAsked(name.trim());
  };

  return (
    <DeskShell>
      <Hero eyebrow={copy.stEyebrow} title={copy.stH1} lede={copy.stLede} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <form className={card} onSubmit={onSubmit}>
          <label className="block text-sm font-medium">
            {copy.stLabel}
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.stPh} className={field} />
          </label>
          <button type="submit" disabled={name.trim().length < 2} className={submit}>
            {copy.check}
          </button>
        </form>
        {verdict ? (
          <article className={`mt-8 ${card} mm-drop`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{copy.stOpen}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {clarify ? copy.stClarify : verdict.marks.length ? localVerdictTitle(lang, verdict) : copy.stMiss}
            </h2>
            {verdict.marks.length && !clarify ? <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{copy.stHit}</p> : null}
            {verdict.marks.length ? (
              <p className="mt-3 text-sm font-medium text-bis-navy dark:text-blue-300">
                {ui.marks}: {verdict.marks.join(', ')}
              </p>
            ) : null}
            <Steps lines={copy.stSteps} />
            <OfficialLink href={MORE_URL.kys} label={copy.stOpen} />
          </article>
        ) : (
          <div className="mt-8">
            <Steps lines={copy.stSteps} />
            <OfficialLink href={MORE_URL.kys} label={copy.stOpen} />
          </div>
        )}
      </section>
    </DeskShell>
  );
}

const SCHEMES: { id: CertScheme; href: string }[] = [
  { id: 'isi', href: MORE_URL.manak },
  { id: 'crs', href: MORE_URL.crs },
  { id: 'fmcs', href: MORE_URL.bis },
];

export function CertifyPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = moreCopy(lang);
  const [scheme, setScheme] = useState<CertScheme | null>(null);
  const steps = scheme === 'crs' ? copy.crsSteps : scheme === 'fmcs' ? copy.fmcsSteps : scheme === 'isi' ? copy.isiSteps : [];
  const link = SCHEMES.find((row) => row.id === scheme);
  const linkLabel = scheme === 'crs' ? copy.openCrs : scheme === 'fmcs' ? copy.openBis : copy.openManak;

  return (
    <DeskShell>
      <Hero eyebrow={copy.ceEyebrow} title={copy.ceH1} lede={copy.ceLede} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{copy.pick}</p>
        <div className="mt-3 grid gap-3">
          {SCHEMES.map((row) => {
            const on = scheme === row.id;
            const title = row.id === 'isi' ? copy.isi : row.id === 'crs' ? copy.crs : copy.fmcs;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setScheme(row.id)}
                className={`flex w-full items-center rounded-[1.5rem] border bg-white px-4 py-4 text-left text-base font-semibold mm-lift dark:bg-[#10182a] ${
                  on ? 'border-bis-navy text-slate-950 dark:border-blue-400 dark:text-white' : 'border-line text-slate-800 hover:border-bis-navy/40 dark:border-slate-700 dark:text-slate-100'
                }`}
              >
                {title}
              </button>
            );
          })}
        </div>
        {scheme && link ? (
          <article className={`mt-8 ${card} mm-drop`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{copy.notLive}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {scheme === 'isi' ? copy.isi : scheme === 'crs' ? copy.crs : copy.fmcs}
            </h2>
            <Steps lines={steps} />
            <OfficialLink href={link.href} label={linkLabel} />
          </article>
        ) : null}
      </section>
    </DeskShell>
  );
}

export function ComplaintPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = moreCopy(lang);

  return (
    <DeskShell>
      <Hero eyebrow={copy.coEyebrow} title={copy.coH1} lede={copy.coLede} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className={card}>
          <Steps lines={copy.coSteps} />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <OfficialLink href={MORE_URL.complaint} label={copy.openComplaint} className="" />
            <a
              href={`mailto:${copy.emailLine}`}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-bis-navy mm-press dark:border-slate-600 dark:text-blue-200"
            >
              {copy.emailLine}
            </a>
          </div>
        </article>
      </section>
    </DeskShell>
  );
}
