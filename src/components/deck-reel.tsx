'use client';

import { useEffect, useState } from 'react';
import { Award, FileSearch, Gem, Microscope, Send } from 'lucide-react';
import ManakMark from '@/components/manak-mark';
import type { LandingCopy } from '@/lib/landing-copy';

type Slide = {
  kicker: string;
  title: string;
  body: string;
  wash: string;
  kind: 'ask' | 'rows' | 'answer' | 'check';
  query?: string;
};

const FULL = 9999;

function slidesFor(t: LandingCopy): Slide[] {
  return [
    {
      kind: 'ask',
      kicker: t.steps[0]?.t ?? '',
      title: t.starters[0]?.label ?? t.h1,
      body: t.steps[0]?.d ?? '',
      query: t.starters[0]?.query,
      wash: 'mm-wash-0',
    },
    {
      kind: 'rows',
      kicker: t.steps[1]?.t ?? '',
      title: t.caps[0]?.title ?? '',
      body: t.steps[1]?.d ?? '',
      wash: 'mm-wash-1',
    },
    {
      kind: 'answer',
      kicker: t.steps[2]?.t ?? '',
      title: t.steps[2]?.t ?? '',
      body: t.steps[2]?.d ?? '',
      wash: 'mm-wash-2',
    },
    {
      kind: 'check',
      kicker: t.caps[3]?.title ?? '',
      title: t.starters[2]?.label ?? t.caps[3]?.title ?? '',
      body: t.caps[3]?.body ?? '',
      query: t.starters[2]?.query,
      wash: 'mm-wash-3',
    },
  ];
}

function PaperLines({ kind }: { kind: string }) {
  const ink = '#0b1f3a';
  const alpha = 0.2;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 320"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke={ink} strokeOpacity={alpha} strokeWidth="1.4" strokeLinecap="round">
        {kind === 'mm-wash-1' ? (
          <>
            <ellipse cx="210" cy="150" rx="150" ry="92" />
            <ellipse cx="196" cy="156" rx="108" ry="64" />
            <ellipse cx="188" cy="160" rx="64" ry="36" />
            <path d="M-10 46c70 28 120-36 190-8s120 40 220 4" />
            <path d="M-10 250c80-30 140 36 210 4s110-28 200 16" />
          </>
        ) : kind === 'mm-wash-2' ? (
          <>
            <path d="M28 42l86 18M48 88l112-14M36 132l96 22M150 36l28 48M188 96l92 14" />
            <path d="M70 176l120-18M168 156l78 26M250 48l54 36M286 118l78-18M118 214l108 12" />
            <path d="M220 200l70 20M40 230l64-16" />
          </>
        ) : (
          <>
            <path d="M-20 42c60-28 110 36 180 4s120 36 210-6" />
            <path d="M-20 92c70-26 120 40 190 6s110 32 210-8" />
            <path d="M-20 146c64-30 124 38 196 4s116 34 214-10" />
            <path d="M-20 200c72-28 118 42 188 8s112 30 212-6" />
            <path d="M-16 252c68-24 122 36 186 6s120 28 200-4" />
          </>
        )}
      </g>
    </svg>
  );
}

function Caret({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="mm-deck-caret" />;
}

function Face({ slide, t, chars }: { slide: Slide; t: LandingCopy; chars: number }) {
  const line = slide.query ?? slide.body;
  const typed = chars >= line.length ? line : line.slice(0, Math.max(0, chars));
  const caret = chars < line.length;
  return (
    <div
      className={`relative h-[318px] overflow-hidden rounded-[1.55rem] border border-[#0b1f3a]/12 shadow-[0_28px_46px_-24px_rgba(11,31,58,0.48)] sm:h-[432px] ${slide.wash}`}
    >
      <PaperLines kind={slide.wash} />
      <div className="absolute inset-x-4 top-8 sm:inset-x-8 sm:top-14">
        <div className="rounded-[1.15rem] bg-white px-4 py-3.5 shadow-[0_18px_36px_-22px_rgba(11,31,58,0.55)] ring-1 ring-[#0b1f3a]/10 sm:px-5 sm:py-4">
          {slide.kind === 'rows' ? (
            <>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-bis-navy uppercase">{slide.kicker}</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  { Icon: FileSearch, title: t.caps[0]?.title, body: t.caps[0]?.body },
                  { Icon: Award, title: t.caps[1]?.title, body: t.caps[1]?.body },
                  { Icon: Microscope, title: t.caps[4]?.title, body: t.caps[4]?.body },
                ].map((row) => (
                  <li key={row.title} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8] text-bis-navy">
                      <row.Icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{row.title}</span>
                      <span className="mt-0.5 line-clamp-1 block text-xs leading-relaxed text-slate-600">{row.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : slide.kind === 'answer' ? (
            <div className="flex gap-3">
              <ManakMark className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{slide.title}</p>
                <p className="mt-1.5 min-h-[3.25rem] text-sm leading-relaxed text-slate-600">
                  {typed}
                  <Caret on={caret} />
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                {slide.kind === 'check' ? (
                  <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff4e8] text-bis-saffron">
                    <Gem className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                ) : (
                  <p className="mb-1.5 text-[10px] font-semibold tracking-[0.16em] text-bis-navy uppercase">{slide.kicker}</p>
                )}
                <p className="min-h-[3.25rem] text-[15px] leading-snug font-medium text-ink">
                  {typed}
                  <Caret on={caret} />
                </p>
              </div>
              <span className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bis-saffron text-white shadow-[0_8px_16px_-10px_rgba(220,128,38,0.9)]">
                <Send className="h-4 w-4" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeckReel({ t }: { t: LandingCopy }) {
  const slides = slidesFor(t);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'out'>('idle');
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [typed, setTyped] = useState(FULL);
  const count = slides.length;
  const slide = slides[index] ?? slides[0];
  const next = slides[(index + 1) % count] ?? slide;
  const focus = phase === 'out' ? (index + 1) % count : index;
  const copy = slides[focus] ?? slide;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setTimeout(() => setPhase('out'), 3800);
    return () => window.clearTimeout(id);
  }, [reduce, paused, index]);

  useEffect(() => {
    if (phase !== 'out') return;
    if (!reduce) setTyped(0);
    const id = window.setTimeout(() => {
      setIndex((n) => (n + 1) % count);
      setPhase('idle');
    }, reduce ? 0 : 1120);
    return () => window.clearTimeout(id);
  }, [phase, reduce, count]);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => {
      setTyped((n) => (n >= 320 ? n : n + 1));
    }, 16);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  function pick(n: number) {
    if (phase === 'out') return;
    if (n === index) return;
    setTyped(FULL);
    setIndex(n);
  }

  const caps = [3, 2, 1];

  return (
    <section
      className="overflow-x-clip border-t border-line bg-paper dark:border-slate-800 dark:bg-[#0c1222]"
      aria-label={t.howHeading}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[3.25rem_minmax(0,0.88fr)_minmax(0,1.2fr)] lg:items-stretch lg:gap-x-10">
        <ol className="relative hidden h-full flex-col justify-between py-8 lg:flex">
          <span className="absolute top-10 bottom-10 left-[4px] w-px bg-slate-200 dark:bg-slate-700" />
          {slides.map((item, n) => {
            const on = n === focus;
            return (
              <li key={item.kicker}>
                <button
                  type="button"
                  onClick={() => pick(n)}
                  aria-current={on ? 'true' : undefined}
                  aria-label={item.kicker}
                  className="relative z-10 flex min-h-11 items-center gap-3"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? 'bg-bis-saffron shadow-[0_0_0_4px_rgba(220,128,38,0.2)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                  <span className={`font-mono text-xs font-semibold tabular-nums ${on ? 'text-ink dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}`}>
                    {String(n + 1).padStart(2, '0')}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-xs font-semibold tracking-[0.16em] text-bis-navy uppercase dark:text-blue-300">
            {t.eyebrow}
          </p>
          {copy.kicker !== copy.title ? (
            <p key={copy.kicker} className="mm-deck-copy mt-5 text-xs font-semibold tracking-wide text-bis-saffron">
              {copy.kicker}
            </p>
          ) : null}
          <h2
            key={copy.title}
            className="mm-deck-copy mt-2 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-[2.65rem] sm:leading-[1.12] dark:text-slate-50"
          >
            {copy.title}
          </h2>
          <p key={`${focus}-${copy.body}`} className="mm-deck-copy mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            {copy.body}
          </p>
          <ol className="mt-8 space-y-1 lg:hidden">
            {slides.map((item, n) => {
              const on = n === focus;
              return (
                <li key={item.kicker}>
                  <button
                    type="button"
                    onClick={() => pick(n)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm ${on ? 'font-semibold text-ink dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-bis-saffron' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    <span className="w-6 font-mono text-xs font-semibold text-bis-saffron tabular-nums">
                      {String(n + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 truncate">{item.kicker}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mm-deck-stage relative min-w-0" aria-hidden>
          {caps.map((offset, i) => {
            const behind = slides[(index + offset) % count] ?? slide;
            return (
              <div
                key={offset}
                className={`pointer-events-none absolute inset-x-0 rounded-[1.55rem] border border-[#0b1f3a]/15 shadow-[inset_0_-2px_0_rgba(11,31,58,0.12)] ${behind.wash}`}
                style={{ top: i * 20, bottom: 12, zIndex: i + 1 }}
              />
            );
          })}
          <div className="relative z-10 mt-[60px]">
            <div className="invisible" aria-hidden>
              <Face slide={slide} t={t} chars={FULL} />
            </div>
            <div className="absolute inset-0">
              <Face slide={next} t={t} chars={phase === 'out' ? typed : 0} />
            </div>
            <div className={`absolute inset-0 ${phase === 'out' ? 'mm-deck-fling' : ''}`}>
              <Face slide={slide} t={t} chars={phase === 'out' ? FULL : typed} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
