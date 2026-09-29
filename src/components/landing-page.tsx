'use client';

import { useEffect, useRef, useSyncExternalStore, type ComponentType } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardList,
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

type TileIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type Tile = {
  label: string;
  body: string;
  query: string;
  Icon: TileIcon;
};

function heroTiles(t: LandingCopy): { left: Tile[]; right: Tile[] } {
  const s = t.starters;
  const c = t.caps;
  const links = t.links;
  return {
    left: [
      { label: s[0].label, body: c[0].body, query: s[0].query, Icon: FileSearch },
      { label: c[4].title, body: c[4].body, query: c[4].title, Icon: Microscope },
      { label: c[3].title, body: c[3].body, query: s[2].query, Icon: Gem },
      { label: links[0].title, body: links[0].job, query: links[0].title, Icon: BookOpen },
      { label: s[3].label, body: links[6].job, query: s[3].query, Icon: Scale },
      { label: links[2].title, body: links[2].job, query: links[2].title, Icon: Award },
    ],
    right: [
      { label: s[1].label, body: c[1].body, query: s[1].query, Icon: Award },
      { label: c[5].title, body: c[5].body, query: c[5].title, Icon: Globe },
      { label: c[1].title, body: c[1].body, query: s[1].query, Icon: BadgeCheck },
      { label: links[5].title, body: links[5].job, query: s[2].query, Icon: Gem },
      { label: c[2].title, body: c[2].body, query: c[2].title, Icon: ClipboardList },
      { label: links[7].title, body: links[7].job, query: c[4].title, Icon: Microscope },
    ],
  };
}

function SideField({ t, onPick }: { t: LandingCopy; onPick: (query: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { left, right } = heroTiles(t);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 520);
        el.style.setProperty('--mm-scroll', `${y}`);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={stageRef} className="mm-orbit-stage pointer-events-none absolute inset-x-0 -bottom-28 top-0 z-0 hidden xl:block">
      {left.map((tile, i) => (
        <ArcCard key={`l-${tile.label}`} tile={tile} side="left" index={i} count={left.length} onPick={onPick} />
      ))}
      {right.map((tile, i) => (
        <ArcCard key={`r-${tile.label}`} tile={tile} side="right" index={i} count={right.length} onPick={onPick} />
      ))}
    </div>
  );
}

function ArcCard({
  tile,
  side,
  index,
  count,
  onPick,
}: {
  tile: Tile;
  side: 'left' | 'right';
  index: number;
  count: number;
  onPick: (query: string) => void;
}) {
  const lane = index % 3;
  const loop = (side === 'left' ? 40 : 44) + lane * 7;
  return (
    <div
      className={`mm-arc pointer-events-auto ${side === 'left' ? `mm-arc-l mm-arc-l${lane}` : `mm-arc-r mm-arc-r${lane}`}`}
      style={{
        animationDuration: `${loop}s`,
        animationDelay: `${-((index * loop) / count + lane * 4)}s`,
      }}
    >
      <button
        type="button"
        onClick={() => onPick(tile.query)}
        className="group relative w-full rounded-xl border-2 border-[#0B1F3A] bg-white px-2.5 py-2 text-left shadow-[0_14px_28px_-12px_rgba(11,31,58,0.38)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_18px_32px_-12px_rgba(11,31,58,0.48)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-saffron dark:border-bis-saffron dark:bg-[#1b335c] dark:shadow-[0_16px_32px_-14px_rgba(0,0,0,0.75)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0B1F3A] text-bis-saffron dark:bg-bis-saffron dark:text-[#0B1F3A]">
          <tile.Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
        </span>
        <span className="mt-1.5 line-clamp-2 block text-[12px] leading-snug font-semibold text-[#0B1F3A] dark:text-white">
          {tile.label}
        </span>
        <span
          className={`pointer-events-none absolute top-0 z-30 hidden w-52 rounded-xl border-2 border-[#0B1F3A] bg-white p-3 text-xs leading-relaxed font-medium text-[#0B1F3A] shadow-lg group-hover:block group-focus-visible:block dark:border-bis-saffron dark:bg-[#122033] dark:text-white ${
            side === 'left' ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'
          }`}
        >
          {tile.body}
        </span>
      </button>
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
    <div className="min-h-[100dvh] overflow-x-visible mm-theme-fade bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader variant="landing" />

      <main id="mm-main">
        <section className="relative">
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
