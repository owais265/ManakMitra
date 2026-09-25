'use client';

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import ManakMark from '@/components/manak-mark';
import FaqPopup from '@/components/faq-popup';
import { chromeCopy } from '@/lib/chrome-copy';
import { faqCopy } from '@/lib/faq-copy';
import { moreCopy } from '@/lib/more-copy';
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

const PORTAL_HREFS = [
  'https://standards.bis.gov.in/website/know-your-standards',
  'https://www.manakonline.in',
  'https://www.crsbis.in/BIS/about-crs.do',
  'https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en',
  'https://www.bis.gov.in/bis-apps/?lang=en',
  'https://huid.manakonline.in/MANAK/HallmarkingHomePage',
  'https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en',
  'https://lims.bis.gov.in/home/search_is_number/',
] as const;

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
  const chrome = chromeCopy(language);
  const faq = faqCopy(language);
  const more = moreCopy(language);
  const navigate = useNavigate();
  const [portalsOpen, setPortalsOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);
  const justOpened = useRef(0);
  const path = useRouterState({ select: (state) => state.location.pathname });

  const closeMenus = () => {
    setPortalsOpen(false);
    setFaqOpen(false);
    setMoreOpen(false);
    setSheetOpen(false);
  };

  const goContact = () => {
    closeMenus();
    const el = document.getElementById('mm-contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    void navigate({ to: '/', hash: 'mm-contact' });
  };

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const armClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(closeMenus, 140);
  };

  const showMenu = (which: 'portals' | 'faq' | 'more') => {
    cancelClose();
    justOpened.current = Date.now();
    setPortalsOpen(which === 'portals');
    setFaqOpen(which === 'faq');
    setMoreOpen(which === 'more');
  };

  const toggleMenu = (which: 'portals' | 'faq' | 'more') => {
    if (Date.now() - justOpened.current < 500) {
      showMenu(which);
      return;
    }
    cancelClose();
    setPortalsOpen(which === 'portals' ? (open) => !open : false);
    setFaqOpen(which === 'faq' ? (open) => !open : false);
    setMoreOpen(which === 'more' ? (open) => !open : false);
  };

  useEffect(() => {
    initTheme();
    initLang();
  }, []);

  useEffect(() => {
    setFaqOpen(false);
    setPortalsOpen(false);
    setMoreOpen(false);
    setSheetOpen(false);
  }, [path]);

  useEffect(() => {
    if (!portalsOpen && !faqOpen && !moreOpen && !sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus();
    };
    document.addEventListener('keydown', onKey);
    const onDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [portalsOpen, faqOpen, moreOpen, sheetOpen]);

  const bar =
    variant === 'landing'
      ? 'mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 lg:gap-6'
      : 'flex min-h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5';

  const primary = copy.links.slice(0, 5);
  const secondary = copy.links.slice(5);
  const item =
    'inline-flex h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm mm-press hover:bg-slate-200/90 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white';

  return (
    <header ref={headerRef} className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white mm-theme-fade dark:border-slate-700 dark:bg-[#0c1222]">
      <div className={bar}>
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5" onClick={closeMenus}>
          <ManakMark
            className={
              variant === 'landing'
                ? 'h-9 w-9 shrink-0 rounded-full'
                : 'h-8 w-8 shrink-0 rounded-full'
            }
          />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base dark:text-slate-50">
              ManakMitra
            </span>
            {variant === 'landing' ? (
              <span className="hidden text-[11px] font-medium tracking-wide text-slate-500 sm:block dark:text-slate-400">
                {chrome.desk}
              </span>
            ) : null}
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-4 lg:flex lg:gap-6" aria-label={chrome.portals}>
          <button
            type="button"
            aria-expanded={portalsOpen}
            aria-controls="mm-portals-panel"
            onMouseEnter={() => showMenu('portals')}
            onMouseLeave={armClose}
            onClick={() => toggleMenu('portals')}
            className={`${item} gap-1.5 font-medium ${
              portalsOpen
                ? 'bg-slate-200/90 text-slate-950 dark:bg-white/10 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {chrome.portals}
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${portalsOpen ? 'rotate-180' : ''}`} />
          </button>
          {(
            [
              ['/verify', chrome.verify],
              ['/labs', chrome.labs],
              ['/product-file', chrome.file],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              to={href}
              onClick={closeMenus}
              className={`${item} ${
                path === href
                  ? 'bg-slate-200/90 font-semibold text-slate-950 dark:bg-white/10 dark:text-white'
                  : 'font-medium text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="mm-more-panel"
            onMouseEnter={() => showMenu('more')}
            onMouseLeave={armClose}
            onClick={() => toggleMenu('more')}
            className={`${item} gap-1.5 font-medium ${
              moreOpen || path === '/huid' || path === '/hallmark' || path === '/standards' || path === '/certify' || path === '/complaint'
                ? 'bg-slate-200/90 text-slate-950 dark:bg-white/10 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {more.more}
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            aria-expanded={faqOpen}
            aria-controls="mm-faq-panel"
            onMouseEnter={() => showMenu('faq')}
            onMouseLeave={armClose}
            onClick={() => toggleMenu('faq')}
            className={`${item} gap-1.5 font-medium ${
              faqOpen
                ? 'bg-slate-200/90 text-slate-950 dark:bg-white/10 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {faq.label}
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${faqOpen ? 'rotate-180' : ''}`} />
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded border border-line text-ink lg:hidden dark:border-slate-600 dark:text-slate-200"
            aria-expanded={sheetOpen}
            aria-controls="mm-sheet"
            onClick={() => {
              cancelClose();
              setPortalsOpen(false);
              setFaqOpen(false);
              setMoreOpen(false);
              setSheetOpen((open) => !open);
            }}
          >
            {sheetOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">{sheetOpen ? 'Close' : 'Menu'}</span>
          </button>
          <label className="sr-only" htmlFor="mm-lang-header">
            {copy.langLabel}
          </label>
          <select
            id="mm-lang-header"
            aria-label={copy.langLabel}
            value={language}
            onChange={(e) => setLang(e.target.value as AppLang)}
            className="h-11 max-w-[7.5rem] truncate rounded border border-line bg-white px-2 text-sm text-ink sm:max-w-[10rem] dark:border-slate-600 dark:bg-[#151d30] dark:text-slate-100"
          >
            {APP_LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.native}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => toggleTheme()}
            aria-label={dark ? chrome.lightMode : chrome.darkMode}
            aria-pressed={dark}
            className="inline-flex h-11 w-11 items-center justify-center rounded border border-line text-ink hover:bg-paper dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#151d30]"
          >
            {dark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
          </button>
          {trailing}
        </div>
      </div>

      {sheetOpen ? (
        <div
          id="mm-sheet"
          className="absolute inset-x-0 top-full z-50 max-h-[min(78dvh,40rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl lg:hidden dark:border-slate-700 dark:bg-[#0c1222]"
        >
          <nav className="mx-auto flex max-w-6xl flex-col px-3 py-3" aria-label={chrome.portals}>
            <button
              type="button"
              className="flex min-h-11 items-center rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
              onClick={() => {
                setSheetOpen(false);
                showMenu('portals');
              }}
            >
              {chrome.portals}
            </button>
            {(
              [
                ['/verify', chrome.verify],
                ['/labs', chrome.labs],
                ['/product-file', chrome.file],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                to={href}
                onClick={closeMenus}
                className={`flex min-h-11 items-center rounded-lg px-3 text-base ${
                  path === href ? 'bg-slate-100 font-semibold text-ink dark:bg-white/10 dark:text-white' : 'font-medium text-ink dark:text-slate-100'
                }`}
              >
                {label}
              </Link>
            ))}
            <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{more.more}</p>
            {(
              [
                ['/huid', more.huid],
                ['/hallmark', more.hallmark],
                ['/standards', more.standards],
                ['/certify', more.certify],
                ['/complaint', more.complaint],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                to={href}
                onClick={closeMenus}
                className={`flex min-h-11 items-center rounded-lg px-3 text-base ${
                  path === href ? 'bg-slate-100 font-semibold text-ink dark:bg-white/10 dark:text-white' : 'font-medium text-ink dark:text-slate-100'
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={goContact}
              className="flex min-h-11 items-center rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
            >
              {more.contact}
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
              onClick={() => {
                setSheetOpen(false);
                showMenu('faq');
              }}
            >
              {faq.label}
            </button>
          </nav>
        </div>
      ) : null}

      {portalsOpen ? (
        <div
          id="mm-portals-panel"
          role="region"
          aria-label={copy.portalsHeading}
          className="absolute inset-x-0 top-full border-b border-slate-800 bg-slate-950 text-white shadow-2xl mm-drop"
          onMouseEnter={cancelClose}
          onMouseLeave={armClose}
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 sm:px-8 lg:grid-cols-2 lg:py-12">
            <div>
              <p className="text-sm text-slate-400">{copy.portalsHeading}</p>
              <ul className="mt-6 space-y-1">
                {primary.map((link, index) => (
                  <li key={PORTAL_HREFS[index]}>
                    <a
                      href={PORTAL_HREFS[index]}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMenus}
                      className="block rounded-lg px-2 py-2 text-2xl font-medium tracking-tight text-white transition-[transform,background-color,color] duration-150 ease-out hover:translate-x-1 hover:bg-white/10 hover:text-slate-200 motion-reduce:hover:translate-x-0 sm:text-3xl"
                    >
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm text-slate-400">{chrome.also}</p>
              <ul className="mt-6 space-y-1">
                {secondary.map((link, index) => {
                  const href = PORTAL_HREFS[index + primary.length];
                  if (!href) return null;
                  return (
                    <li key={href}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMenus}
                        className="block rounded-lg px-2 py-2 transition-[transform,background-color] duration-150 ease-out hover:translate-x-1 hover:bg-white/10 motion-reduce:hover:translate-x-0"
                      >
                        <span className="block text-lg font-medium text-white">{link.title}</span>
                        <span className="mt-1 block max-w-sm text-sm leading-relaxed text-slate-400">{link.job}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
      {moreOpen ? (
        <div
          id="mm-more-panel"
          role="region"
          aria-label={more.more}
          className="absolute inset-x-0 top-full border-b border-slate-800 bg-slate-950 text-white shadow-2xl mm-drop"
          onMouseEnter={cancelClose}
          onMouseLeave={armClose}
        >
          <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
            <p className="text-sm text-slate-400">{more.more}</p>
            <ul className="mt-4 grid gap-1 sm:grid-cols-2">
              {(
                [
                  ['/huid', more.huid, more.huidJob],
                  ['/hallmark', more.hallmark, more.hallmarkJob],
                  ['/standards', more.standards, more.standardsJob],
                  ['/certify', more.certify, more.certifyJob],
                  ['/complaint', more.complaint, more.complaintJob],
                ] as const
              ).map(([href, title, job]) => (
                <li key={href}>
                  <Link
                    to={href}
                    onClick={closeMenus}
                    className={`block rounded-lg px-2 py-2 transition-[transform,background-color] duration-150 ease-out hover:translate-x-1 hover:bg-white/10 motion-reduce:hover:translate-x-0 ${
                      path === href ? 'bg-white/10' : ''
                    }`}
                  >
                    <span className="block text-lg font-medium text-white">{title}</span>
                    <span className="mt-1 block max-w-sm text-sm leading-relaxed text-slate-400">{job}</span>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={goContact}
                  className="block w-full rounded-lg px-2 py-2 text-left transition-[transform,background-color] duration-150 ease-out hover:translate-x-1 hover:bg-white/10 motion-reduce:hover:translate-x-0"
                >
                  <span className="block text-lg font-medium text-white">{more.contact}</span>
                  <span className="mt-1 block max-w-sm text-sm leading-relaxed text-slate-400">{more.contactJob}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
      {faqOpen ? (
        <div
          id="mm-faq-panel"
          role="region"
          aria-label={faq.title}
          className="absolute inset-x-0 top-full max-h-[min(78vh,44rem)] overflow-y-auto border-b border-slate-800 bg-slate-950 text-white shadow-2xl mm-drop"
          onMouseEnter={cancelClose}
          onMouseLeave={armClose}
        >
          <FaqPopup copy={faq} />
        </div>
      ) : null}
    </header>
  );
}
