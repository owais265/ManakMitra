'use client';

import { Link } from '@tanstack/react-router';
import { Globe, Mail, MapPin, Phone, Scale, Shield } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import ManakMark from '@/components/manak-mark';
import { chromeCopy } from '@/lib/chrome-copy';
import { APP_LANGS, type AppLang } from '@/lib/language';
import { landingCopy } from '@/lib/landing-copy';
import { moreCopy } from '@/lib/more-copy';
import { getLangServerSnapshot, getLangSnapshot, setLang, subscribeLang } from '@/lib/lang-store';

const linkClass =
  'inline-flex min-h-11 items-center text-sm text-slate-300 transition-colors duration-150 hover:text-white';

export default function SiteFooter() {
  const language = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const chrome = chromeCopy(language);
  const copy = landingCopy(language);
  const more = moreCopy(language);
  const product = [
    { to: '/chat' as const, label: chrome.assistant },
    { to: '/verify' as const, label: chrome.verify },
    { to: '/labs' as const, label: chrome.labs },
    { to: '/product-file' as const, label: chrome.file },
    { to: '/huid' as const, label: more.huid },
    { to: '/hallmark' as const, label: more.hallmark },
    { to: '/standards' as const, label: more.standards },
    { to: '/certify' as const, label: more.certify },
    { to: '/complaint' as const, label: more.complaint },
  ];
  const official = [
    { href: 'https://standards.bis.gov.in/website/know-your-standards', label: copy.links[0]?.title ?? 'Know Your Standard' },
    { href: 'https://www.manakonline.in', label: copy.links[1]?.title ?? 'MANAK Online' },
    { href: 'https://www.crsbis.in/BIS/about-crs.do', label: copy.links[2]?.title ?? 'CRS' },
    { href: 'https://huid.manakonline.in/MANAK/HallmarkingHomePage', label: copy.links[5]?.title ?? 'HUID' },
    { href: 'https://lims.bis.gov.in/home/search_is_number/', label: chrome.labSearch },
    { href: 'https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en', label: chrome.complaint },
  ];
  const desk = [
    { to: '/' as const, label: chrome.home },
    { to: '/privacy' as const, label: chrome.privacy },
    { to: '/terms' as const, label: chrome.terms },
  ];

  useEffect(() => {
    const scroll = () => {
      if (window.location.hash !== '#mm-contact') return;
      document.getElementById('mm-contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const frame = window.requestAnimationFrame(scroll);
    window.addEventListener('hashchange', scroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', scroll);
    };
  }, []);

  return (
    <footer id="mm-contact" className="relative scroll-mt-20 overflow-hidden border-t border-slate-800 bg-[#0B1F3A] text-slate-200">
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,0.7fr))]">
          <div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-2.5">
              <ManakMark className="h-9 w-9 rounded-full" />
              <span className="text-lg font-semibold tracking-tight text-white">ManakMitra</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">{chrome.blurb}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              <li>
                <a href="https://www.bis.gov.in/?lang=en" target="_blank" rel="noopener noreferrer" aria-label={chrome.official} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 transition-colors duration-150 hover:bg-white/10">
                  <Globe className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en" target="_blank" rel="noopener noreferrer" aria-label={chrome.complaint} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 transition-colors duration-150 hover:bg-white/10">
                  <Scale className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="mailto:complaints@bis.gov.in" aria-label={chrome.contact} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 transition-colors duration-150 hover:bg-white/10">
                  <Mail className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="https://www.google.com/maps/search/?api=1&query=Bureau%20of%20Indian%20Standards%209%20Bahadur%20Shah%20Zafar%20Marg%20New%20Delhi" target="_blank" rel="noopener noreferrer" aria-label={chrome.address} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-slate-200 transition-colors duration-150 hover:bg-white/10">
                  <MapPin className="h-4 w-4" />
                </a>
              </li>
            </ul>
          </div>

          <nav aria-label={chrome.product}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{chrome.product}</p>
            <ul className="mt-3">
              {product.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={linkClass}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={chrome.official}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{chrome.official}</p>
            <ul className="mt-3">
              {official.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bis-saffron">{chrome.contact}</p>
            <ul className="mt-3 space-y-1 text-sm leading-relaxed text-slate-300">
              <li>
                <a href="mailto:complaints@bis.gov.in" className={linkClass}>
                  <Mail className="mr-2 h-4 w-4 shrink-0 text-bis-saffron" />
                  complaints@bis.gov.in
                </a>
              </li>
              <li>
                <a href="tel:+911123235609" className={linkClass}>
                  <Phone className="mr-2 h-4 w-4 shrink-0 text-bis-saffron" />
                  011 2323 5609
                </a>
              </li>
              <li>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Bureau%20of%20Indian%20Standards%209%20Bahadur%20Shah%20Zafar%20Marg%20New%20Delhi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <MapPin className="mr-2 h-4 w-4 shrink-0 text-bis-saffron" />
                  {chrome.address}
                </a>
              </li>
            </ul>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {chrome.published}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-400">© {new Date().getFullYear()} ManakMitra.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="sr-only" htmlFor="mm-lang-footer">{chrome.langLabel}</label>
            <select
              id="mm-lang-footer"
              aria-label={chrome.langLabel}
              value={language}
              onChange={(event) => setLang(event.target.value as AppLang)}
              className="h-11 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white"
            >
              {APP_LANGS.map((lang) => (
                <option key={lang.id} value={lang.id} className="text-ink">
                  {lang.native}
                </option>
              ))}
            </select>
            {desk.map((item) => (
              <Link key={item.to} to={item.to} className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}