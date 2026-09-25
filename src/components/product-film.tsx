'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Award, FileSearch, Microscope, Play } from 'lucide-react';
import ManakMark from '@/components/manak-mark';
import type { LandingCopy } from '@/lib/landing-copy';

type Pose = {
  x: number;
  y: number;
  r: number;
  s: number;
  o: number;
  z: number;
  w: number;
};

type Mode = 'rest' | 'open' | 'closing';

type Box = { left: number; top: number; width: number; height: number };

const ICONS = [FileSearch, Award, Microscope] as const;

/** Four arrangements. Cards fly out, fan, then sit back down. */
const SCENES: Pose[][] = [
  [
    { x: 5, y: 7, r: -4, s: 1, o: 1, z: 5, w: 44 },
    { x: 50, y: 12, r: 4, s: 1, o: 1, z: 4, w: 44 },
    { x: 4, y: 50, r: -3, s: 1, o: 1, z: 6, w: 30 },
    { x: 35, y: 54, r: 1, s: 1, o: 1, z: 6, w: 30 },
    { x: 66, y: 48, r: 3, s: 1, o: 1, z: 6, w: 30 },
  ],
  [
    { x: -48, y: 8, r: -14, s: 0.86, o: 0, z: 1, w: 44 },
    { x: 14, y: 22, r: 0, s: 1, o: 1, z: 6, w: 72 },
    { x: -28, y: 80, r: -8, s: 0.8, o: 0, z: 1, w: 30 },
    { x: 36, y: 120, r: 2, s: 0.8, o: 0, z: 1, w: 30 },
    { x: 108, y: 28, r: 12, s: 0.8, o: 0, z: 1, w: 30 },
  ],
  [
    { x: -42, y: -24, r: -10, s: 0.84, o: 0, z: 1, w: 40 },
    { x: 88, y: -30, r: 10, s: 0.84, o: 0, z: 1, w: 40 },
    { x: 3, y: 26, r: -4, s: 1, o: 1, z: 4, w: 30 },
    { x: 35, y: 20, r: 0, s: 1.02, o: 1, z: 6, w: 30 },
    { x: 67, y: 28, r: 4, s: 1, o: 1, z: 5, w: 30 },
  ],
  [
    { x: 72, y: -36, r: 8, s: 0.84, o: 0, z: 1, w: 36 },
    { x: 12, y: 5, r: 0, s: 1, o: 1, z: 3, w: 76 },
    { x: 4, y: 62, r: -1, s: 1, o: 1, z: 5, w: 30 },
    { x: 35, y: 62, r: 0, s: 1, o: 1, z: 5, w: 30 },
    { x: 66, y: 62, r: 1, s: 1, o: 1, z: 5, w: 30 },
  ],
];

const NARROW: Pose[][] = [
  [
    { x: 4, y: 3, r: -2, s: 1, o: 1, z: 4, w: 92 },
    { x: 4, y: 58, r: 2, s: 1, o: 1, z: 5, w: 92 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
  ],
  [
    { x: -70, y: 4, r: -8, s: 0.9, o: 0, z: 1, w: 70 },
    { x: 6, y: 16, r: 0, s: 1, o: 1, z: 6, w: 88 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 6, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
  ],
  [
    { x: -60, y: 0, r: -6, s: 0.85, o: 0, z: 1, w: 50 },
    { x: 70, y: -20, r: 6, s: 0.85, o: 0, z: 1, w: 50 },
    { x: 4, y: 4, r: -1, s: 1, o: 1, z: 4, w: 92 },
    { x: 4, y: 36, r: 0, s: 1, o: 1, z: 5, w: 92 },
    { x: 4, y: 68, r: 1, s: 1, o: 1, z: 4, w: 92 },
  ],
  [
    { x: 80, y: -24, r: 6, s: 0.85, o: 0, z: 1, w: 40 },
    { x: 4, y: 3, r: 0, s: 1, o: 1, z: 4, w: 92 },
    { x: 4, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 4, y: 130, r: 0, s: 1, o: 0, z: 1, w: 40 },
    { x: 4, y: 58, r: 1, s: 1, o: 1, z: 5, w: 92 },
  ],
];

function destRect(ratio = 16 / 10): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gutter = vw < 640 ? 12 : 40;
  let width = Math.min(1120, vw - gutter * 2);
  let height = width / ratio;
  const maxH = vh - gutter * 2;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
  };
}

function Slide({ pose, children }: { pose: Pose; children: ReactNode }) {
  return (
    <div
      className="mm-slide absolute overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_-24px_rgba(11,31,58,0.6)]"
      style={{
        left: `${pose.x}%`,
        top: `${pose.y}%`,
        width: `${pose.w}%`,
        zIndex: pose.z,
        opacity: pose.o,
        transform: `rotate(${pose.r}deg) scale(${pose.s})`,
      }}
    >
      {children}
    </div>
  );
}

function Device({
  t,
  poses,
  playing,
  onPlay,
}: {
  t: LandingCopy;
  poses: Pose[];
  playing: boolean;
  onPlay?: () => void;
}) {
  const caps = [t.caps[0], t.caps[1], t.caps[4]];
  return (
    <div
      className={`flex h-full flex-col rounded-[1.7rem] bg-white p-2 shadow-[0_30px_70px_-28px_rgba(11,31,58,0.55)] ring-1 ring-line sm:p-3 dark:bg-[#151d30] dark:ring-white/10 ${onPlay ? 'cursor-pointer' : ''}`}
      onClick={onPlay}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.15rem] bg-paper">
        <div className="absolute inset-0" aria-hidden>
          <Slide pose={poses[0]}>
            <div className="px-3 py-3 sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-bis-navy uppercase sm:text-xs">
                {t.eyebrow}
              </p>
              <p className="mt-1.5 text-sm leading-snug font-semibold text-ink sm:text-base">
                {t.starters[0]?.label}
              </p>
            </div>
          </Slide>
          <Slide pose={poses[1]}>
            <div className="px-3 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <ManakMark className="h-7 w-7 shrink-0" />
                <p className="text-sm font-semibold text-ink">{t.steps[2]?.t}</p>
              </div>
              <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {t.steps[2]?.d}
              </p>
            </div>
          </Slide>
          {caps.map((cap, i) => {
            const Icon = ICONS[i] ?? FileSearch;
            return (
              <Slide key={cap?.title ?? i} pose={poses[i + 2]}>
                <div className="px-3 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-bis-navy">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{cap?.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{cap?.body}</p>
                </div>
              </Slide>
            );
          })}
        </div>
        {onPlay ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
            className="mm-play z-20 flex items-center justify-center rounded-[1.25rem] bg-bis-navy text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bis-saffron sm:rounded-[1.4rem]"
            aria-label="Play"
          >
            <Play className="ml-0.5 h-7 w-7 fill-current sm:ml-1 sm:h-8 sm:w-8" strokeWidth={0} />
          </button>
        ) : null}
        {playing ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-2.5 z-20 h-1 overflow-hidden rounded-full bg-white/70" aria-hidden>
            <div className="mm-film-bar h-full w-full rounded-full bg-bis-saffron" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProductFilm({ t }: { t: LandingCopy }) {
  const [mode, setMode] = useState<Mode>('rest');
  const [scene, setScene] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<DOMRect | null>(null);
  const animRef = useRef<Animation | null>(null);
  const intentRef = useRef<'open' | null>(null);
  const settledRef = useRef(false);
  const modeRef = useRef<Mode>('rest');
  const lockRef = useRef<{ html: string; body: string; pad: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const order = mode === 'rest' ? (narrow ? [0, 3] : [0, 2, 3]) : [0, 1, 2, 3];
    let timer = 0;
    const wait = mode === 'rest' ? 2400 : 600;
    const gap = mode === 'rest' ? 3400 : 2100;
    const tick = () => {
      setScene((n) => {
        const i = order.indexOf(n);
        return order[(i < 0 ? 0 : i + 1) % order.length];
      });
      timer = window.setTimeout(tick, gap);
    };
    timer = window.setTimeout(tick, wait);
    return () => window.clearTimeout(timer);
  }, [reduce, mode, narrow]);

  useEffect(() => {
    if (mode === 'rest') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  useLayoutEffect(() => {
    if (mode === 'rest') {
      animRef.current?.cancel();
      animRef.current = null;
      unlockScroll();
      return;
    }
    if (mode !== 'open' || intentRef.current !== 'open') return;
    intentRef.current = null;
    const shell = shellRef.current;
    const first = firstRef.current;
    if (!shell) return;
    const ratio = first && first.height > 0 ? first.width / first.height : 16 / 10;
    const dest = destRect(ratio);
    shell.style.left = `${dest.left}px`;
    shell.style.top = `${dest.top}px`;
    shell.style.width = `${dest.width}px`;
    shell.style.height = `${dest.height}px`;
    shell.style.transformOrigin = 'center center';
    if (!first || reduce) {
      shell.style.transform = 'translate(0px, 0px) scale(1)';
      settledRef.current = true;
      return;
    }
    const dx = first.left + first.width / 2 - (dest.left + dest.width / 2);
    const dy = first.top + first.height / 2 - (dest.top + dest.height / 2);
    const s = first.width / dest.width;
    const from = `translate(${dx}px, ${dy}px) scale(${s})`;
    shell.style.transform = from;
    const anim = shell.animate(
      [
        { transform: from },
        { transform: 'translate(0px, 0px) scale(1.065)', offset: 0.68 },
        { transform: 'translate(0px, 0px) scale(1)' },
      ],
      { duration: 660, easing: 'cubic-bezier(0.2, 0.85, 0.24, 1)', fill: 'forwards' },
    );
    animRef.current = anim;
    anim.onfinish = () => {
      if (animRef.current !== anim) return;
      shell.style.transform = 'translate(0px, 0px) scale(1)';
      anim.cancel();
      animRef.current = null;
      settledRef.current = true;
    };
  }, [mode, reduce]);

  useEffect(() => {
    if (mode !== 'open') return;
    const onResize = () => {
      const shell = shellRef.current;
      if (!shell || !settledRef.current) return;
      const slot = slotRef.current?.getBoundingClientRect();
      const ratio = slot && slot.height > 0 ? slot.width / slot.height : 16 / 10;
      const dest = destRect(ratio);
      shell.style.left = `${dest.left}px`;
      shell.style.top = `${dest.top}px`;
      shell.style.width = `${dest.width}px`;
      shell.style.height = `${dest.height}px`;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mode]);

  function lockScroll() {
    if (lockRef.current) return;
    const html = document.documentElement;
    const body = document.body;
    const gap = window.innerWidth - html.clientWidth;
    lockRef.current = {
      html: html.style.overflow,
      body: body.style.overflow,
      pad: body.style.paddingRight,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  }

  function unlockScroll() {
    const prev = lockRef.current;
    if (!prev) return;
    lockRef.current = null;
    document.documentElement.style.overflow = prev.html;
    document.body.style.overflow = prev.body;
    document.body.style.paddingRight = prev.pad;
  }

  function play() {
    if (modeRef.current !== 'rest') return;
    lockScroll();
    firstRef.current = slotRef.current?.getBoundingClientRect() ?? null;
    intentRef.current = 'open';
    settledRef.current = false;
    modeRef.current = 'open';
    setMode('open');
  }

  function close() {
    if (modeRef.current === 'rest' || modeRef.current === 'closing') return;
    const shell = shellRef.current;
    const slot = slotRef.current;
    if (!shell || !slot || reduce) {
      modeRef.current = 'rest';
      setMode('rest');
      return;
    }
    const destLeft = parseFloat(shell.style.left);
    const destTop = parseFloat(shell.style.top);
    const destW = parseFloat(shell.style.width);
    const destH = parseFloat(shell.style.height);
    if (!Number.isFinite(destW) || destW <= 0) {
      modeRef.current = 'rest';
      setMode('rest');
      return;
    }
    const computed = getComputedStyle(shell).transform;
    const current = !computed || computed === 'none' ? 'translate(0px, 0px) scale(1)' : computed;
    shell.style.transform = current;
    animRef.current?.cancel();
    animRef.current = null;
    const slotR = slot.getBoundingClientRect();
    const dx = slotR.left + slotR.width / 2 - (destLeft + destW / 2);
    const dy = slotR.top + slotR.height / 2 - (destTop + destH / 2);
    const s = slotR.width / destW;
    const end = `translate(${dx}px, ${dy}px) scale(${s})`;
    const pop = settledRef.current;
    settledRef.current = false;
    modeRef.current = 'closing';
    setMode('closing');
    const frames: Keyframe[] = pop
      ? [
          { transform: 'translate(0px, 0px) scale(1)' },
          { transform: 'translate(0px, 0px) scale(1.1)', offset: 0.16 },
          { transform: end },
        ]
      : [
          { transform: current },
          { transform: end },
        ];
    const anim = shell.animate(frames, {
      duration: pop ? 480 : 400,
      easing: 'cubic-bezier(0.4, 0.02, 0.2, 1)',
      fill: 'forwards',
    });
    animRef.current = anim;
    anim.onfinish = () => {
      if (animRef.current !== anim) return;
      modeRef.current = 'rest';
      setMode('rest');
    };
  }

  const poses = (narrow ? NARROW : SCENES)[scene] ?? SCENES[0];
  const open = mode !== 'rest';

  return (
    <section className="px-4 pt-1 pb-8 sm:px-6 sm:pb-12" aria-label={t.eyebrow}>
      <div ref={slotRef} className="relative mx-auto w-full max-w-3xl">
        <div className="aspect-[5/4] sm:aspect-[16/10]" />
        {mode === 'rest' ? (
          <div className="absolute inset-0">
            <Device t={t} poses={poses} playing={false} onPlay={play} />
          </div>
        ) : null}
      </div>
      {open && mounted
        ? createPortal(
            <>
              <button
                type="button"
                className={`fixed inset-0 z-[80] bg-bis-navy/80 backdrop-blur-[2px] ${mode === 'closing' ? 'mm-film-dim-out' : 'mm-film-dim-in'}`}
                aria-label="Close"
                onClick={close}
              />
              <div
                ref={shellRef}
                className="fixed z-[90] outline-none"
                role="dialog"
                aria-modal="true"
                aria-label={t.h1}
              >
                <Device t={t} poses={poses} playing />
              </div>
            </>,
            document.body,
          )
        : null}
    </section>
  );
}
