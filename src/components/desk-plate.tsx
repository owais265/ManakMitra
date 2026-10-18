import type { ReactNode } from "react";

/** Shared desk surfaces. Navy, saffron, and paper stay the site palette. */
export const deskField =
  "mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-slate-600 focus:border-bis-navy dark:border-slate-500 dark:bg-[#0c1222] dark:text-slate-50 dark:placeholder:text-slate-300";

export const deskCard =
  "rounded-[1.75rem] border border-line bg-white p-5 text-ink sm:p-8 dark:border-slate-500 dark:bg-[#151d30] dark:text-slate-50";

/** The answer is the one saffron edge. Forms stay plain so the result is obvious. */
export const answerPlate = `${deskCard} border-l-4 border-l-[#dc8026]`;

export const deskSubmit =
  "mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-bis-navy px-6 text-sm font-semibold text-white mm-press hover:bg-bis-navy-deep disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#1e293b] dark:disabled:bg-[#334155] dark:disabled:text-[#f8fafc]";

export const deskNote = "text-sm leading-relaxed text-slate-700 dark:text-slate-200";

/** Saffron as a fill fails as small type on paper. This ink passes on white and on the dark card. */
export const deskMark = "text-sm font-semibold text-[#7a3e08] dark:text-[#f6c98a]";

export function MarkSlots({ value }: { value: string }) {
  const chars = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).split("");
  return (
    <div className="mt-3 flex gap-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="flex h-12 w-10 items-center justify-center rounded-xl border border-line bg-white text-lg font-semibold text-ink dark:border-slate-500 dark:bg-[#0c1222] dark:text-slate-50"
        >
          {chars[index] || ""}
        </span>
      ))}
    </div>
  );
}

export function DeskFacts({ facts }: { facts: { title: string; body: string }[] }) {
  return (
    <ul className="mx-auto grid max-w-3xl gap-3 px-4 text-left sm:grid-cols-3 sm:px-6">
      {facts.map((fact) => (
        <li key={fact.title} className="rounded-2xl border border-line bg-white px-4 py-3 dark:border-slate-500 dark:bg-[#151d30]">
          <p className="text-sm font-semibold text-ink dark:text-slate-50">{fact.title}</p>
          <p className={`mt-1 ${deskNote}`}>{fact.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function PlateSection({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</section>;
}
