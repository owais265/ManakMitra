'use client';

import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
import { Moon, Sun } from 'lucide-react';
import ManakMark from '@/components/manak-mark';
import { APP_LANGS, type AppLang } from '@/lib/language';
import { landingCopy } from '@/lib/landing-copy';
import { getThemeSnapshot, getThemeServerSnapshot, initTheme, subscribeTheme, toggleTheme } from '@/lib/theme';
import {
  getLangServerSnapshot,
  getLangSnapshot,
  initLang,
  setLang,
  subscribeLang,
} from '@/lib/lang-store';

export default function SiteHeader({
  variant = 'landing',
  trailing,
}: {
  variant?: 'landing' | 'chat';
  trailing?: ReactNode;
}) {
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const language = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const copy = landingCopy(language);

  useEffect(() => {
    initTheme();
    initLang();
  }, []);

  const inner =
    variant === 'landing'
      ? 'mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6'
      : 'flex h-12 items-center justify-between gap-3 px-3 sm:h-14 sm:px-5';

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white mm-theme-fade dark:border-slate-700 dark:bg-[#0c1222]">
      <div className={inner}>
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
          <ManakMark
            className={
              variant === 'landing'
                ? 'h-9 w-9 shrink-0 rounded-full'
                : 'h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9'
            }
          />
          <span className="flex min-w-0 flex-col justify-center leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base dark:text-slate-50">
              ManakMitra
            </span>
            <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:block dark:text-slate-400">
              {variant === 'landing' ? copy.tagline : copy.chatSuffix}
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {variant === 'landing' && (
            <>
              <label className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:inline dark:text-slate-400" htmlFor="mm-lang-landing">
                {copy.langLabel}
              </label>
              <select
                id="mm-lang-landing"
                aria-label={copy.langLabel}
                value={language}
                onChange={(e) => setLang(e.target.value as AppLang)}
                className="h-9 max-w-[7.5rem] rounded border border-slate-300 bg-white px-2 text-sm text-slate-800 sm:max-w-[10rem] dark:border-slate-600 dark:bg-[#151d30] dark:text-slate-100"
              >
                {APP_LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.native}
                  </option>
                ))}
              </select>

              <span className="hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-600" aria-hidden="true" />

              <button
                type="button"
                onClick={() => toggleTheme()}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={dark}
                title={dark ? 'Light mode' : 'Dark mode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#151d30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bis-navy"
              >
                {dark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
              </button>
            </>
          )}

          {trailing}
        </div>
      </div>
    </header>
  );
}
