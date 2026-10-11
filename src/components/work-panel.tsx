'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { GraphStop, WorkStep } from '@/lib/work-trace';

const LANE: Record<GraphStop['lane'], string> = {
  product: 'Product',
  standard: 'Standard',
  source: 'Source',
  note: 'What we can say',
};

function formatTook(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = safe / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

export default function WorkPanel({
  startedAt,
  finishedAt,
  steps,
  stops,
}: {
  startedAt: number;
  finishedAt?: number;
  steps: WorkStep[];
  stops?: GraphStop[];
}) {
  const live = !finishedAt;
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!live) setOpen(false);
  }, [live]);

  const ms = Math.max(0, (finishedAt ?? Date.now()) - startedAt);
  const took = formatTook(ms);
  const whole = Math.floor(ms / 1000);
  const latest = steps[steps.length - 1];
  const showBody = !live && open;

  return (
    <div className="mb-3 min-w-0">
      {live ? (
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300" aria-hidden="true">
            <span className="mm-work-shine">Working</span>
            <span className="ml-2 tabular-nums text-slate-500 dark:text-slate-400">{took}</span>
          </p>
          <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none">
            <p className="overflow-hidden pt-1 text-sm text-slate-500 dark:text-slate-400 mm-break">
              {latest ? `${latest.label} · ${latest.detail}` : 'Reading the question'}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <span className="tabular-nums">Worked for {took}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {live ? `Working ${whole} seconds` : `Worked for ${took}`}
      </p>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${showBody ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {steps.length ? (
            <ul className="mt-2 space-y-1.5">
              {steps.map((step) => (
                <li key={step.id} className="flex items-baseline justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <span className="min-w-0 mm-break">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {step.detail}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                    {step.ms < 1000 ? `${step.ms} ms` : formatTook(step.ms)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {stops && stops.length ? (
            <ol className="mt-3 grid gap-3 sm:grid-cols-4">
              {stops.map((stop) => (
                <li key={stop.lane} className="min-w-0 border-t-2 border-bis-navy/40 pt-2 dark:border-blue-300/50">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{LANE[stop.lane]}</p>
                  {stop.href ? (
                    <a href={stop.href} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm text-blue-800 underline dark:text-blue-300">
                      {stop.text}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm leading-snug text-slate-800 mm-break dark:text-slate-100">{stop.text}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}
