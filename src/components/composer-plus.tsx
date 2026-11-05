import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileText, Paperclip, Plus, X, Check } from "lucide-react";
import type { AppLang } from "@/lib/language";
import { loadRecent, type RecentFile } from "@/lib/recent-files";

const COPY: Record<AppLang, { upload: string; recent: string; empty: string; remove: string }> = {
  en: { upload: "Upload a file", recent: "Recent files", empty: "No recent files", remove: "Remove" },
  hi: { upload: "फ़ाइल अपलोड करें", recent: "हाल की फ़ाइलें", empty: "कोई हाल की फ़ाइल नहीं", remove: "हटाएँ" },
  bn: { upload: "ফাইল আপলোড করুন", recent: "সাম্প্রতিক ফাইল", empty: "কোনো সাম্প্রতিক ফাইল নেই", remove: "সরান" },
  ta: { upload: "கோப்பைப் பதிவேற்று", recent: "சமீபத்திய கோப்புகள்", empty: "சமீபத்திய கோப்பு இல்லை", remove: "நீக்கு" },
  te: { upload: "ఫైల్ అప్‌లోడ్ చేయండి", recent: "ఇటీవలి ఫైళ్లు", empty: "ఇటీవలి ఫైళ్లు లేవు", remove: "తీసివేయి" },
  mr: { upload: "फाइल अपलोड करा", recent: "अलीकडील फाइल", empty: "अलीकडील फाइल नाही", remove: "काढा" },
  gu: { upload: "ફાઇલ અપલોડ કરો", recent: "તાજેતરની ફાઇલો", empty: "તાજેતરની ફાઇલ નથી", remove: "દૂર કરો" },
  kn: { upload: "ಕಡತ ಅಪ್‌ಲೋಡ್", recent: "ಇತ್ತೀಚಿನ ಕಡತಗಳು", empty: "ಇತ್ತೀಚಿನ ಕಡತಗಳಿಲ್ಲ", remove: "ತೆಗೆ" },
  ml: { upload: "ഫയൽ അപ്‌ലോഡ്", recent: "സമീപകാല ഫയലുകൾ", empty: "സമീപകാല ഫയലുകൾ ഇല്ല", remove: "നീക്കം" },
  pa: { upload: "ਫ਼ਾਈਲ ਅੱਪਲੋਡ", recent: "ਤਾਜ਼ਾ ਫ਼ਾਈਲਾਂ", empty: "ਕੋਈ ਤਾਜ਼ਾ ਫ਼ਾਈਲ ਨਹੀਂ", remove: "ਹਟਾਓ" },
  ur: { upload: "فائل اپ لوڈ کریں", recent: "حالیہ فائلیں", empty: "کوئی حالیہ فائل نہیں", remove: "ہٹائیں" },
  or: { upload: "ଫାଇଲ ଅପଲୋଡ଼", recent: "ସାମ୍ପ୍ରତିକ ଫାଇଲ", empty: "ସାମ୍ପ୍ରତିକ ଫାଇଲ ନାହିଁ", remove: "ହଟାନ୍ତୁ" },
};

export type DraftFile = { name: string; kind: "png" | "image" | "text"; text?: string; dataUrl?: string };

function extOf(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext.length > 5 ? "FILE" : ext;
}

export function DraftChip({ file, language, onRemove }: { file: DraftFile; language: AppLang; onRemove: () => void }) {
  const copy = COPY[language];
  const image = file.kind !== "text" && file.dataUrl;
  return (
    <div className="px-3 pt-3">
      {image ? (
        <div className="relative h-[72px] w-[72px]">
          <img src={file.dataUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
          <button
            type="button"
            aria-label={`${copy.remove} ${file.name}`}
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="relative inline-flex h-[72px] max-w-[240px] items-center gap-2.5 rounded-2xl border border-slate-200 bg-white pr-3 pl-2.5 dark:border-white/10 dark:bg-[#2a2926]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 pr-2">
            <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{extOf(file.name)}</span>
          </span>
          <button
            type="button"
            aria-label={`${copy.remove} ${file.name}`}
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function PlusMenu({
  language,
  attachLabel,
  onUpload,
  onPick,
}: {
  language: AppLang;
  attachLabel: string;
  onUpload: () => void;
  onPick: (file: RecentFile) => void;
}) {
  const copy = COPY[language];
  const [open, setOpen] = useState(false);
  const [recentOn, setRecentOn] = useState(false);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setRecentOn(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setRecentOn(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          role="menu"
          className="absolute bottom-12 left-0 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1c1b19]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setRecentOn(false);
              onUpload();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
            {copy.upload}
          </button>
          <button
            type="button"
            role="menuitem"
            aria-expanded={recentOn}
            onClick={() => {
              setRecent(loadRecent());
              setRecentOn((on) => !on);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
          >
            <Clock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
            <span className="flex-1">{copy.recent}</span>
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${recentOn ? "rotate-90" : ""}`} />
          </button>
          {recentOn ? (
            <div className="mt-1 border-t border-slate-200 pt-1 dark:border-white/10">
              {recent.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{copy.empty}</p>
              ) : (
                recent.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      setRecentOn(false);
                      onPick(file);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    {file.dataUrl && file.kind !== "text" ? (
                      <img src={file.dataUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                        <FileText className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{extOf(file.name)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={attachLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((on) => !on)}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-white/10 ${open ? "bg-slate-200/80 dark:bg-white/10" : ""}`}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

export type SearchMode = "fast" | "deep";

export function SearchModeMenu({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: SearchMode) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div role="menu" className="absolute right-0 bottom-12 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1c1b19]">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={mode === "fast"}
            onClick={() => pick("fast")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Fast</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">The usual catalogue answer</span>
            </span>
            {mode === "fast" ? <Check className="h-4 w-4 text-slate-700 dark:text-slate-200" /> : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={mode === "deep"}
            onClick={() => pick("deep")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Deep search</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Local and hybrid, then cross-check</span>
            </span>
            {mode === "deep" ? <Check className="h-4 w-4 text-slate-700 dark:text-slate-200" /> : null}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((on) => !on)}
        className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 dark:text-slate-200 dark:hover:bg-white/10"
      >
        {mode === "deep" ? "Deep" : "Fast"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
