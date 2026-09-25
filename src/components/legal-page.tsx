'use client';

import { useSyncExternalStore } from 'react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { chromeCopy } from '@/lib/chrome-copy';
import { legalCopy, type LegalPageCopy } from '@/lib/legal-copy';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const page: LegalPageCopy = legalCopy(lang)[kind];
  const chrome = chromeCopy(lang);

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bis-navy dark:text-blue-300">{page.kicker}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl dark:text-slate-50">{page.title}</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{chrome.updated}</p>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">{page.lede}</p>
        <div className="mt-10 space-y-8">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-ink dark:text-slate-50">{section.heading}</h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}