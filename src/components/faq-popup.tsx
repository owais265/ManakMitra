'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import type { FaqCopy } from '@/lib/faq-copy';

export default function FaqPopup({ copy }: { copy: FaqCopy }) {
  const titleId = useId();
  const [current, setCurrent] = useState(0);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-12">
      <div>
        <p className="text-sm text-slate-400">{copy.label}</p>
        <h2 id={titleId} className="mt-6 text-3xl font-medium tracking-tight text-white sm:text-4xl">
          {copy.title}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">{copy.lede}</p>
        <p className="mt-8 max-w-md text-xs leading-relaxed text-slate-500">{copy.note}</p>
      </div>
      <ul>
        {copy.items.map((item, index) => {
          const on = index === current;
          const panelId = `${titleId}-a-${index}`;
          return (
            <li key={item.q} className="border-b border-white/10">
              <button
                type="button"
                aria-expanded={on}
                aria-controls={panelId}
                onClick={() => setCurrent(on ? -1 : index)}
                className="flex min-h-12 w-full items-start gap-4 rounded-lg px-2 py-3 text-left transition-[transform,background-color] duration-150 ease-out hover:translate-x-1 hover:bg-white/10 motion-reduce:hover:translate-x-0"
              >
                <span className="min-w-0 flex-1 pt-0.5 text-lg font-medium tracking-tight text-white sm:text-xl">
                  {item.q}
                </span>
                <span
                  className={`mm-faq-plus mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                    on ? 'rotate-45 border-bis-saffron text-bis-saffron' : 'border-white/25 text-slate-300'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
              </button>
              <div id={panelId} className="mm-faq-fold" data-open={on ? 'true' : 'false'} role="region">
                <div>
                  <p className="pb-4 pr-12 pl-2 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
