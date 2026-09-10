'use client';

import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Award,
  Building2,
  FileSearch,
  Gem,
  Globe,
  Landmark,
  MessageSquare,
  Microscope,
  Scale,
  ShieldCheck,
} from 'lucide-react';

const STARTERS = [
  {
    label: 'Find the IS for my product',
    query: 'Which Indian Standard applies to PET bottles used for drinking water?',
  },
  {
    label: 'ISI mark steps',
    query: 'How do I apply for an ISI mark under Scheme-I on Manakonline?',
  },
  {
    label: 'CRS / Scheme-II',
    query: 'What is the BIS Compulsory Registration Scheme (CRS) process?',
  },
  {
    label: 'Verify hallmark / HUID',
    query: 'How do I verify gold jewellery hallmark and HUID on the BIS Care App?',
  },
  {
    label: 'Testing lab near me',
    query: 'Is there a BIS-recognised Group-1 laboratory in Raipur, Chhattisgarh?',
  },
  {
    label: 'Consumer complaint',
    query: 'Where do I file a BIS consumer complaint for a product with a fake Standard Mark?',
  },
] as const;

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: 'Indian Standards',
    body: 'Match a product description or IS number to catalogue metadata — title, group, and the official record.',
  },
  {
    icon: Award,
    title: 'Certification schemes',
    body: 'Scheme-I ISI, Scheme-II CRS, FMCS and QCO routes — which mark applies, and which does not.',
  },
  {
    icon: Scale,
    title: 'Process guidance',
    body: 'Application steps, portals (Manakonline, crsbis.in), and official FAQ figures when they are in the pack.',
  },
  {
    icon: Gem,
    title: 'Hallmarking',
    body: 'Purity grades, HUID, and how a consumer checks jewellery instead of trusting a shop claim.',
  },
  {
    icon: Microscope,
    title: 'Recognised labs',
    body: 'Point to BIS Group-1 laboratories by city and official list — scope stays on the live PDF.',
  },
  {
    icon: Globe,
    title: 'Indian languages',
    body: 'Ask in Hindi, English, or other scheduled-language scripts. Answers stay inside BIS.',
  },
] as const;

function openAssistant(query?: string) {
  if (typeof window !== 'undefined' && query?.trim()) {
    sessionStorage.setItem('mm_seed_query', query.trim());
  }
}

export default function LandingPage() {
  const navigate = useNavigate();

  const go = (query?: string) => {
    openAssistant(query);
    void navigate({ to: '/chat' });
  };

  return (
    <div className="min-h-[100dvh] overflow-x-clip overflow-y-visible bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bis-navy shadow-sm">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-slate-900">ManakMitra</span>
              <span className="text-xs font-medium tracking-wide text-slate-500">BIS AI Assistant</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => go()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-bis-navy px-4 text-sm font-semibold text-white transition-transform duration-150 ease-out hover:bg-bis-navy-deep active:scale-[0.96]"
          >
            Open assistant
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-8 text-center sm:px-6 sm:pt-20">
          <p className="mm-rise mm-d1 text-xs font-semibold tracking-[0.18em] text-bis-navy uppercase">
            Bureau of Indian Standards
          </p>
          <h1 className="mm-rise mm-d2 mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl md:text-6xl md:leading-[1.12]">
            Ask about Indian Standards
          </h1>
          <p className="mm-rise mm-d3 mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            Source-backed answers on applicable IS numbers, ISI / CRS / FMCS, hallmarking, and recognised labs — in plain language. If it is not in the authorised catalogue, ManakMitra says so.
          </p>

          <div className="mm-rise mm-d4 mt-8 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => go(s.query)}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-paper px-3.5 text-sm font-medium text-slate-700 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-bis-navy/30 hover:bg-white hover:text-bis-navy active:scale-[0.96]"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-slate-900">
              Built for the questions BIS users actually ask
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-pretty text-slate-600 sm:text-base">
              MSMEs, startups, students and consumers currently hunt across portals and PDFs for the same six jobs. ManakMitra holds those jobs in one conversation.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <article
                key={c.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-bis-navy/25"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-bis-navy">
                  <c.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-paper">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How a question is answered</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Same pattern as a retrieval-augmented assistant — stored as an authorised BIS pack inside this site, not as a guess.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              {[
                {
                  n: '01',
                  t: 'Ask in plain language',
                  d: 'Product, IS number, scheme, city lab, or hallmark — Hindi or English.',
                },
                {
                  n: '02',
                  t: 'Retrieve official rows',
                  d: 'Search the authorised catalogue: standards, CRS products, process FAQs, labs.',
                },
                {
                  n: '03',
                  t: 'Answer from evidence',
                  d: 'AI writes only from those hits, with source links. No hit → a clear refusal.',
                },
              ].map((step) => (
                <li key={step.n} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <span className="font-mono text-xs font-semibold text-bis-saffron tabular-nums">{step.n}</span>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">{step.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-bis-navy p-7 text-white sm:p-9">
              <Landmark className="h-7 w-7 text-bis-saffron" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Why this exists</h2>
              <p className="mt-3 text-sm leading-relaxed text-blue-100 sm:text-base">
                BIS publishes thousands of Indian Standards and runs certification, hallmarking, laboratory recognition, training and consumer services. Finding the applicable standard, the right scheme, and the next official step still means jumping across documents. ManakMitra is the conversational layer on that public record.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-blue-50">
                <li className="flex gap-2">
                  <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-bis-saffron" />
                  Recommend applicable IS rows from a product description
                </li>
                <li className="flex gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-bis-saffron" />
                  Guide ISI, CRS, FMCS and consumer complaints
                </li>
                <li className="flex gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-bis-saffron" />
                  Point to recognised labs and official portals — never invent an IS number
                </li>
              </ul>
              <button
                type="button"
                onClick={() => go()}
                className="mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-bis-navy transition-transform duration-150 ease-out hover:bg-blue-50 active:scale-[0.96]"
              >
                Start with ManakMitra
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col justify-between rounded-3xl border border-slate-200 p-7 sm:p-9">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What it will not do</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Valuators should see the same discipline a live BIS desk would use.
                </p>
                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate-700">
                  <li className="border-l-2 border-bis-saffron pl-3">
                    Full clause text of a paid Indian Standard is not stored. You get official metadata and the portal to read the document.
                  </li>
                  <li className="border-l-2 border-slate-200 pl-3">
                    Fees and timelines only when they appear in the authorised FAQ pack — then re-check the live page.
                  </li>
                  <li className="border-l-2 border-slate-200 pl-3">
                    Out-of-scope chat (sports, movies, general trivia) is declined. The assistant stays inside BIS.
                  </li>
                  <li className="border-l-2 border-slate-200 pl-3">
                    Not a licence, not legal advice, not a replacement for Know Your Standard, Manakonline or crsbis.in.
                  </li>
                </ul>
              </div>
              <p className="mt-8 text-xs leading-relaxed text-slate-500">
                Knowledge pack is public BIS catalogue metadata (IS titles, CRS notified products, Group-1 labs, official process notes). Last verified 8 September 2026.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500 sm:px-6">
          <p>ManakMitra — conversational assistant for Indian Standards and BIS services.</p>
        </div>
      </footer>
    </div>
  );
}
