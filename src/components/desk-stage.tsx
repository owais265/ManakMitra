'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { AppLang } from '@/lib/language';
import { stageCopy } from '@/lib/stage-copy';

const SHOTS = ['/showcase/ask.png', '/showcase/verify.png', '/showcase/labs.png'] as const;

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function smooth(p: number) {
  return p * p * (3 - 2 * p);
}

export default function DeskStage({ lang }: { lang: AppLang }) {
  const copy = stageCopy(lang);
  const [active, setActive] = useState(0);
  const item = copy.items[active] ?? copy.items[0];
  const runwayRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lockRef = useRef<number | null>(null);

  const choose = (index: number) => {
    lockRef.current = index;
    activeRef.current = index;
    setActive(index);
  };

  useLayoutEffect(() => {
    const runway = runwayRef.current;
    const pin = pinRef.current;
    const frame = frameRef.current;
    const rail = railRef.current;
    if (!runway || !pin || !frame) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let lastH = 0;

    const clearPin = () => {
      pin.style.position = '';
      pin.style.top = '';
      pin.style.left = '';
      pin.style.width = '';
      pin.style.zIndex = '';
      runway.style.height = '';
      frame.style.transform = 'none';
      if (rail) {
        rail.style.opacity = '';
        rail.style.transform = '';
      }
    };

    const apply = () => {
      raf = 0;
      if (reduce.matches) {
        clearPin();
        return;
      }
      const header = document.querySelector('header');
      const top = Math.max(56, header?.getBoundingClientRect().height || 64);
      const vh = window.visualViewport?.height || window.innerHeight || 800;
      const vw = window.innerWidth || 360;
      const narrow = vw < 1024;
      const pinH = pin.offsetHeight || Math.round(vh * 0.72);
      const travel = Math.round(vh * (narrow ? 0.9 : 1.15));
      const nextH = pinH + travel;
      if (Math.abs(nextH - lastH) > 2) {
        lastH = nextH;
        runway.style.height = `${nextH}px`;
      }
      const box = runway.getBoundingClientRect();
      const raw = clamp((top - box.top) / travel, 0, 1);
      const e = smooth(raw);
      const open = 1 - e;

      if (box.top > top) {
        pin.style.position = 'relative';
        pin.style.top = '0px';
        pin.style.left = '0px';
        pin.style.width = '100%';
        pin.style.zIndex = '1';
      } else if (box.bottom <= top + pinH + 1) {
        pin.style.position = 'absolute';
        pin.style.top = `${Math.max(0, box.height - pinH)}px`;
        pin.style.left = '0px';
        pin.style.width = '100%';
        pin.style.zIndex = '1';
      } else {
        pin.style.position = 'fixed';
        pin.style.top = `${top}px`;
        pin.style.left = '0px';
        pin.style.width = '100%';
        pin.style.zIndex = '30';
      }

      const railW = !narrow && rail ? rail.offsetWidth : 0;
      const pull = narrow ? Math.min(22, vw * 0.045) : railW * 0.48;
      const shift = narrow ? open * pull : open * -pull;
      const rotY = open * (narrow ? -10 : -13);
      const rotX = open * (narrow ? 7 : 6);
      const lift = open * (narrow ? 8 : 14);
      const scale = 1 + open * (narrow ? 0.035 : 0.06);
      frame.style.transform = `translate3d(${shift}px, ${lift}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`;

      if (rail) {
        const shown = clamp((e - 0.12) / 0.5, 0, 1);
        rail.style.opacity = String(shown);
        rail.style.transform = `translate3d(${(1 - shown) * 18}px, 0, 0)`;
      }

      const zone = raw < 0.34 ? 0 : raw < 0.67 ? 1 : 2;
      if (lockRef.current != null && zone !== lockRef.current) lockRef.current = null;
      if (lockRef.current == null && zone !== activeRef.current) {
        activeRef.current = zone;
        setActive(zone);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    document.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    reduce.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      reduce.removeEventListener('change', schedule);
      clearPin();
    };
  }, []);

  return (
    <section className="relative border-t border-slate-200 bg-paper dark:border-slate-800 dark:bg-[#0c1222]">
      <div ref={runwayRef} className="relative min-h-[140vh]">
        <div ref={pinRef} className="w-full">
          <header className="mx-auto max-w-3xl px-4 pt-8 pb-2 text-center sm:pt-10">
            <p className="text-xs font-semibold tracking-[0.18em] text-bis-saffron uppercase">{copy.eyebrow}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">
              {copy.title}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-pretty text-slate-600 sm:text-lg dark:text-slate-300">
              {copy.lede}
            </p>
          </header>

          <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 pt-3 pb-8 sm:gap-6 sm:px-6 lg:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] lg:gap-10 lg:pt-2 lg:pb-6">
            <div ref={railRef} className="mm-stage-rail hidden lg:block">
              <div className="border-b border-slate-200 dark:border-slate-700">
                {copy.items.map((row, i) => {
                  const on = i === active;
                  return (
                    <button
                      key={row.path}
                      type="button"
                      onClick={() => choose(i)}
                      aria-current={on ? 'true' : undefined}
                      className="block w-full border-t border-slate-200 py-4 text-left dark:border-slate-700"
                    >
                      <span
                        className={`block text-2xl font-semibold tracking-tight text-balance transition-colors duration-300 lg:text-3xl xl:text-4xl ${
                          on ? 'text-ink dark:text-white' : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {row.title}
                      </span>
                      <span
                        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                          on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <span className="overflow-hidden">
                          <span className="mt-2 block text-sm font-medium text-slate-800 dark:text-slate-100">{row.line}</span>
                          <span className="mt-1.5 block pb-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{row.body}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0" style={{ perspective: '1200px' }}>
              <div
                ref={frameRef}
                className="mm-stage-glide mx-auto w-full max-w-[680px] lg:mr-0 lg:ml-auto lg:max-w-[720px]"
                style={{ transformOrigin: '50% 46%', transformStyle: 'preserve-3d' }}
              >
                <div className="overflow-hidden rounded-[1.15rem] border border-slate-700/80 bg-[#1a1f27] shadow-[0_28px_60px_-24px_rgba(11,31,58,0.55)] sm:rounded-[1.35rem] dark:border-slate-600 dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]">
                  <div className="flex h-9 items-center gap-2 px-3 sm:h-11 sm:px-3.5">
                    <span className="h-2 w-2 rounded-full bg-[#e15a45] sm:h-2.5 sm:w-2.5" />
                    <span className="h-2 w-2 rounded-full bg-[#e2b43a] sm:h-2.5 sm:w-2.5" />
                    <span className="h-2 w-2 rounded-full bg-[#3ea36a] sm:h-2.5 sm:w-2.5" />
                    <span className="mx-auto max-w-[68%] truncate rounded-md bg-white/10 px-3 py-1 font-mono text-[10px] text-slate-300 sm:text-[11px]">
                      manakmitra{item.path}
                    </span>
                  </div>
                  <div className="relative aspect-[1120/720] bg-white">
                    {SHOTS.map((src, i) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        draggable={false}
                        className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
                          i === active ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center lg:hidden">
              <p className="text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl dark:text-white">{item.title}</p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{item.line}</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-pretty text-slate-600 dark:text-slate-300">{item.body}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {copy.items.map((row, i) => (
                  <button
                    key={row.path}
                    type="button"
                    aria-current={i === active ? 'true' : undefined}
                    onClick={() => choose(i)}
                    className={`h-11 rounded-full px-4 text-sm font-semibold ${
                      i === active
                        ? 'bg-bis-navy text-white dark:bg-blue-700'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {row.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
