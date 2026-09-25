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
} from 'lucide-react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import ProductFilm from '@/components/product-film';
import DeskStage from '@/components/desk-stage';
import DeckReel from '@/components/deck-reel';
import { landingCopy, type LandingCopy } from '@/lib/landing-copy';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';

const CAP_ICONS = [FileSearch, Award, Scale, Gem, Microscope, Globe] as const;

const WHY_ICONS = [FileSearch, MessageSquare, Building2] as const;

function openAssistant(query?: string) {
  if (typeof window !== 'undefined' && query?.trim()) {
    sessionStorage.setItem('mm_seed_query', query.trim());
  }
}

function SideField({ t, onPick }: { t: LandingCopy; onPick: (query: string) => void }) {
  const left = [
    { label: t.starters[0].label, body: t.caps[0].body, query: t.starters[0].query, Icon: CAP_ICONS[0], tilt: '-7deg' },
    { label: t.caps[4].title, body: t.caps[4].body, query: t.caps[4].title, Icon: CAP_ICONS[4], tilt: '5deg' },
    { label: t.starters[2].label, body: t.caps[3].body, query: t.starters[2].query, Icon: CAP_ICONS[3], tilt: '-3deg' },
  ];
  const right = [
    { label: t.starters[1].label, body: t.caps[1].body, query: t.starters[1].query, Icon: CAP_ICONS[1], tilt: '6deg' },
    { label: t.starters[3].label, body: t.caps[2].body, query: t.starters[3].query, Icon: CAP_ICONS[2], tilt: '-5deg' },
    { label: t.caps[5].title, body: t.caps[5].body, query: t.caps[5].title, Icon: CAP_ICONS[5], tilt: '4deg' },
  ];

  return (
    <>
      <Rail side="left" tiles={left} onPick={onPick} />
      <Rail side="right" tiles={right} onPick={onPick} />
    </>
  );
}

function Rail({
  side,
  tiles,
  onPick,
}: {
  side: 'left' | 'right';
  tiles: { label: string; body: string; query: string; Icon: (typeof CAP_ICONS)[number]; tilt: string }[];
  onPick: (query: string) => void;
}) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 z-0 hidden w-44 xl:block ${side === 'left' ? 'left-3' : 'right-3'}`}>
      <div className={`pointer-events-auto h-[200%] ${side === 'left' ? 'mm-drift' : 'mm-drift-rev'}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex h-1/2 flex-col justify-evenly py-8">
            {tiles.map((tile) => (
              <div key={`${side}-${copy}-${tile.label}`} className="w-[148px]" style={{ transform: `rotate(${tile.tilt})` }}>
                <button
                  type="button"
                  onClick={() => onPick(tile.query)}
                  className="group relative w-full rounded-2xl border border-[#c5d0d8] bg-white p-3 text-left shadow-[0_10px_28px_-12px_rgba(11,31,58,0.45)] ring-1 ring-bis-saffron/70 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-navy dark:border-white/30 dark:bg-[#243656] dark:shadow-[0_14px_32px_-12px_rgba(0,0,0,0.75)] dark:ring-bis-saffron"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff4e8] text-bis-saffron dark:bg-bis-saffron dark:text-white">
                    <tile.Icon className="h-4 w-4" strokeWidth={2.1} />
                  </span>
                  <span className="mt-2 block text-[13px] leading-snug font-semibold text-[#0B1F3A] dark:text-white">{tile.label}</span>
                  <span
                    className={`pointer-events-none absolute top-0 z-30 hidden w-52 rounded-xl border border-[#c5d0d8] bg-white p-3 text-xs leading-relaxed font-medium text-[#0B1F3A] shadow-lg group-hover:block group-focus-visible:block dark:border-white/25 dark:bg-[#122033] dark:text-white ${
                      side === 'left' ? 'left-[calc(100%+12px)]' : 'right-[calc(100%+12px)]'
                    }`}
                  >
                    {tile.body}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
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
    <div className="min-h-[100dvh] overflow-x-clip overflow-y-visible mm-theme-fade bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader variant="landing" />

      <main>
        <section className="relative overflow-hidden">
          <SideField t={t} onPick={(query) => go(query)} />
          <div className="relative z-10 mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <p className="mm-rise mm-d1 text-[11px] font-semibold tracking-[0.14em] text-balance text-bis-navy uppercase sm:text-xs sm:tracking-[0.18em] dark:text-blue-300">
            {t.eyebrow}
          </p>
          <h1 className="mm-rise mm-d2 mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-6xl lg:leading-[1.12] dark:text-slate-50">
            {t.h1}
          </h1>
          <p className="mm-rise mm-d3 mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg dark:text-slate-300">
            {t.lede}
          </p>

          <div className="mm-rise mm-d4 mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => go()}
              className="inline-flex min-h-16 items-center gap-2.5 rounded-full bg-bis-navy px-10 text-lg font-semibold text-white shadow-[0_12px_30px_-16px_rgba(11,31,58,0.7)] transition-transform duration-150 ease-out hover:bg-bis-navy-deep active:scale-[0.96] motion-reduce:transform-none motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-navy sm:min-h-[4.5rem] sm:px-12 sm:text-xl dark:bg-[#1a3f73] dark:shadow-[0_16px_36px_-18px_rgba(0,0,0,0.65)] dark:hover:bg-[#214a86]"
            >
              {t.openAssistant}
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
          </div>
        </section>

        <ProductFilm t={t} />

        <DeskStage lang={lang} />

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
                  className="rounded-[1.5rem] border border-line bg-white p-5 mm-lift hover:border-bis-navy/25 dark:border-slate-700 dark:bg-[#151d30] dark:hover:border-blue-400/30"
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
                <li key={step.t} className="rounded-[1.5rem] border border-line bg-white p-5 dark:border-slate-700 dark:bg-[#151d30]">
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
            <div className="flex flex-col justify-between rounded-[1.75rem] border border-line bg-white p-7 sm:p-9 dark:border-slate-700 dark:bg-[#151d30]">
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

        <DeckReel t={t} />
      </main>

      <SiteFooter />
    </div>
  );
}
