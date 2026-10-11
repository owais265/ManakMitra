'use client';

import { useSyncExternalStore } from 'react';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import { chromeCopy } from '@/lib/chrome-copy';
import { getLangServerSnapshot, getLangSnapshot, subscribeLang } from '@/lib/lang-store';

export default function ContactPage() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const chrome = chromeCopy(lang);

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-[#0c1222] dark:text-slate-100">
      <SiteHeader />
      <main id="mm-main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-navy dark:text-blue-300">{chrome.contact}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50">{chrome.contact}</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">{chrome.published}</p>
        <ul className="mt-8 space-y-3 text-base">
          <li>
            <a href="mailto:complaints@bis.gov.in" className="text-blue-800 underline dark:text-blue-300">
              complaints@bis.gov.in
            </a>
          </li>
          <li>
            <a href="tel:+911123235609" className="text-blue-800 underline dark:text-blue-300">
              011 2323 5609
            </a>
          </li>
          <li className="text-ink dark:text-slate-100">{chrome.address}</li>
        </ul>
        <p className="mt-8">
          <a href="https://www.bis.gov.in/?lang=en" target="_blank" rel="noopener noreferrer" className="text-blue-800 underline dark:text-blue-300">
            bis.gov.in
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
