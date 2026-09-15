'use client';

import { useSyncExternalStore } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Award,
  Building2,
  FileSearch,
  Gem,
  Globe,
  Landmark,
  MessageSquare,
  Microscope,
  Scale,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  FlaskConical,
} from 'lucide-react';
import SiteHeader from '@/components/site-header';
import ManakMark from '@/components/manak-mark';
import { landingCopy } from '@/lib/landing-copy';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';

const CAP_ICONS = [FileSearch, Award, Scale, Gem, Microscope, Globe] as const;
const WHY_ICONS = [FileSearch, MessageSquare, Building2] as const;
const LINK_META = [
  { icon: FileSearch, href: 'https://standards.bis.gov.in/website/know-your-standards' },
  { icon: Award, href: 'https://www.manakonline.in' },
  { icon: ShieldCheck, href: 'https://www.crsbis.in/BIS/about-crs.do' },
  { icon: Scale, href: 'https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en' },
  { icon: Smartphone, href: 'https://www.bis.gov.in/bis-apps/?lang=en' },
  { icon: Gem, href: 'https://huid.manakonline.in/MANAK/HallmarkingHomePage' },
  { icon: MessageSquare, href: 'https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en' },
  { icon: FlaskConical, href: 'https://lims.bis.gov.in/home/search_is_number/' },
] as const;

function openAssistant(query?: string) {
  if (typeof window !== 'undefined' && query?.trim()) {
    sessionStorage.setItem('mm_seed_query', query.trim());
  }
}

export default function LandingPage() {
  const navigate = useNavigate();
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const t = landingCopy(lang);

  const go = (query?: string) => {
    openAssistant(query);
    void navigate({ to: '/chat' });
  };

  return (
    <div className="min-h-[100dvh] overflow-x-clip overflow-y-visible mm-theme-fade bg-white text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader variant="landing" />

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-8 text-center sm:px-6 sm:pt-20">
          <p className="mm-rise mm-d1 text-xs font-semibold tracking-[0.18em] text-bis-navy uppercase dark:text-blue-300">
            {t.eyebrow}
          </p>
          <h1 className="mm-rise mm-d2 mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl md:text-6xl md:leading-[1.12] dark:text-slate-50">
            {t.h1}
          </h1>
          <p className="mm-rise mm-d3 mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg dark:text-slate-300">
            {t.lede}
          </p>

          <div className="mm-rise mm-d4 mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => go()}
              className="inline-flex min-h-14 items-center gap-2 rounded-full bg-bis-navy px-8 text-base font-semibold text-white transition-transform duration-150 ease-out hover:bg-bis-navy-deep active:scale-[0.96] motion-reduce:transform-none motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-navy sm:min-h-16 sm:px-10 sm:text-lg"
            >
              {t.openAssistant}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mm-rise mm-d4 mt-8 flex flex-wrap justify-center gap-2">
            {t.starters.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => go(s.query)}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-paper px-3.5 text-sm font-medium text-slate-700 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-bis-navy/30 hover:bg-white hover:text-bis-navy active:scale-[0.96] motion-reduce:transform-none motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-navy dark:border-slate-600 dark:bg-[#151d30] dark:text-slate-300 dark:hover:border-blue-400/40 dark:hover:bg-[#1c2640] dark:hover:text-blue-200"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-slate-900 dark:text-slate-50">
              {t.capHeading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-pretty text-slate-600 sm:text-base dark:text-slate-300">
              {t.capLede}
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {t.caps.map((c, i) => {
              const Icon = CAP_ICONS[i] ?? FileSearch;
              return (
                <article
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-bis-navy/25 dark:border-slate-700 dark:bg-[#151d30] dark:hover:border-blue-400/30"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-bis-navy dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{c.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-paper dark:border-slate-800 dark:bg-[#10182a]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t.howHeading}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t.howLede}
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              {t.steps.map((step, i) => (
                <li key={step.t} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-[#151d30] dark:ring-slate-700">
                  <span className="font-mono text-xs font-semibold text-bis-saffron tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{step.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-bis-navy p-7 text-white sm:p-9 dark:bg-[#1a2f78]">
              <Landmark className="h-7 w-7 text-bis-saffron" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{t.whyHeading}</h2>
              <p className="mt-3 text-sm leading-relaxed text-blue-100 sm:text-base">
                {t.whyBody}
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-blue-50">
                {t.whyItems.map((item, i) => {
                  const Icon = WHY_ICONS[i] ?? FileSearch;
                  return (
                    <li key={item} className="flex gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bis-saffron" />
                      {item}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => go()}
                className="mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-bis-navy transition-transform duration-150 ease-out hover:bg-blue-50 active:scale-[0.96] motion-reduce:transform-none motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t.startCta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col justify-between rounded-3xl border border-slate-200 p-7 sm:p-9 dark:border-slate-700 dark:bg-[#151d30]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t.notHeading}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t.notLede}
                </p>
                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {t.notItems.map((item, i) => (
                    <li
                      key={item}
                      className={`border-l-2 pl-3 ${i === 0 ? 'border-bis-saffron' : 'border-slate-200 dark:border-slate-600'}`}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-8 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                {t.notFoot}
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-paper dark:border-slate-800 dark:bg-[#10182a]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-slate-900 dark:text-slate-50">
                {t.portalsHeading}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-pretty text-slate-600 sm:text-base dark:text-slate-300">
                {t.portalsLede}
              </p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {t.links.map((link, i) => {
                const meta = LINK_META[i];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <a
                    key={meta.href}
                    href={meta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-bis-navy/30 hover:shadow-sm active:scale-[0.98] motion-reduce:transform-none motion-reduce:active:scale-100 dark:border-slate-700 dark:bg-[#151d30] dark:hover:border-blue-400/30"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-bis-navy dark:bg-blue-950/60 dark:text-blue-300">
                      <Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span>{link.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{link.job}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#0f172a] dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ManakMark className="h-8 w-8 shrink-0 rounded-full" />
            <p className="min-w-0 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-white">ManakMitra</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300">{t.tagline}</span>
              <span className="text-slate-500"> — </span>
              <span className="text-slate-400">{t.footer.split(/\s+[—–-]\s+/).slice(-1)[0]}</span>
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
            <a href="https://www.bis.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
              bis.gov.in
            </a>
            <a href="https://www.manakonline.in" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
              manakonline.in
            </a>
            <a href="https://www.crsbis.in/BIS/about-crs.do" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
              crsbis.in
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
