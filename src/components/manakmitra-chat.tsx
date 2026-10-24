'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { 
  FileText, 
  Send, Mic, CheckCircle, 
  AlertTriangle, XCircle, ExternalLink, X,
  Info, Copy, Check, Share, RotateCcw, WifiOff, Plus, Download, MapPin, ThumbsUp, ThumbsDown, Volume2, Square, Flag
} from 'lucide-react';
import { speechLang, UI_DICTIONARY, type AppLang } from '@/lib/language';
import { loadVoices, pickVoice, readAloudLabel, speechChunks, spokenSlice, voiceTag } from '@/lib/read-aloud';
import { sourcesBelong } from '@/lib/reply-shape';
import { parseAttachment } from '@/lib/attachments';
import { initTheme } from '@/lib/theme';
import { buildDocx, downloadBytes, transcriptPdf, transcriptPng, type ExportTurn } from '@/lib/export-chat';
import ManakMark from '@/components/manak-mark';
import WorkPanel from '@/components/work-panel';
import { readProductLabel } from '@/lib/label-ocr';
import type { GraphStop, WorkStep } from '@/lib/work-trace';
import {
  subscribeLang,
  getLangSnapshot,
  getLangServerSnapshot,
  initLang,
  setLang,
} from '@/lib/lang-store';
import { PACK_VERIFIED } from '@/lib/pack-stamp';
import { MORE_URL } from '@/lib/more-desk';
import SiteHeader from '@/components/site-header';
import { needsDeviceLocation, labsFinderResult, type LabBoard } from '@/lib/desk-route';
import { deskUi } from '@/lib/desk-ui';
import { mapsEmbedUrl, mapsSearchUrl, type RankedLab } from '@/lib/labs';

type MessageRole = 'user' | 'ai';
type Confidence = 'high' | 'medium' | 'low' | null;

interface Source {
  id: string;
  title: string;
  type: string;
  date: string;
  link: string;
}

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: string;
  confidence?: Confidence;
  sources?: Source[];
  followUpQuestions?: string[];
  actions?: { label: string, action: string }[];
  animate?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  retryQuery?: string;
  processSteps?: string[];
  startedAt?: number;
  finishedAt?: number;
  workSteps?: WorkStep[];
  graph?: GraphStop[];
  askLocation?: boolean;
  locationBusy?: boolean;
  locationError?: string;
  labBoard?: LabBoard;
  userQuery?: string;
  vote?: 'up' | 'down';
  labelLicence?: string;
}

function createUniqueId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const KYS_URL = 'https://standards.bis.gov.in/website/know-your-standards';

function isOfficialUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return (
      h === 'bis.gov.in' ||
      h.endsWith('.bis.gov.in') ||
      h === 'manakonline.in' ||
      h.endsWith('.manakonline.in') ||
      h === 'crsbis.in' ||
      h.endsWith('.crsbis.in') ||
      h === 'standardsbis.bsbedge.com' ||
      h === 'india.gov.in' ||
      h.endsWith('.india.gov.in')
    );
  } catch {
    return false;
  }
}

function officialIsHref(sources?: Source[]): string {
  const hit = sources?.find((s) => s.link && isOfficialUrl(s.link));
  return hit?.link || KYS_URL;
}

function isQuestionChip(t: string): boolean {
  const s = t.trim();
  if (/[?？؟]/.test(s)) return true;
  return /^(which|what|where|who|whom|how|why|can you|could you|would you|do you|should we|tell me|क्या|कौन|कहाँ|कैसे|किसे|कोन)\b/i.test(s);
}

function suggestionChips(msg: Message | undefined, language: AppLang): string[] {
  const ui = UI_DICTIONARY[language];
  const fallback = [ui.chipHuid, ui.chipCement, ui.chipLaptop];
  if (!msg || msg.role !== 'ai' || msg.isError || msg.isStreaming) return [];
  const out: string[] = [];
  for (const q of msg.followUpQuestions || []) {
    const t = q.replace(/\bakonline\.in\b/gi, 'manakonline.in').trim();
    if (!t || t.length >= 140) continue;
    if (/add hindi|translation|grok meta/i.test(t)) continue;
    if (isQuestionChip(t)) continue;
    out.push(t);
    if (out.length >= 3) return out;
  }
  let extra = 0;
  for (const s of msg.sources || []) {
    if (out.length >= 3 || extra >= 2) break;
    if (!/product|process|lab|hallmark|faq|consumer/i.test(s.type)) continue;
    const t = s.title.replace(/\s+/g, ' ').trim();
    if (t.length < 8 || t.length > 72) continue;
    if (/add hindi|translation/i.test(t)) continue;
    if (isQuestionChip(t)) continue;
    const key = t.slice(0, 18).toLowerCase();
    if (out.some((x) => x.toLowerCase().includes(key) || t.toLowerCase().includes(x.slice(0, 18).toLowerCase()))) continue;
    out.push(t);
    extra += 1;
  }
  if (out.length) return out.slice(0, 3);
  if (!msg.sources?.length) return fallback;
  return [];
}

function isMapUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return h === 'google.com' && /\/maps/i.test(new URL(url).pathname) || h === 'maps.google.com';
  } catch {
    return false;
  }
}

function openExternal(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!isMapUrl(href)) return;
  event.preventDefault();
  const pop = window.open(href, 'mm-maps', 'popup=yes,width=1040,height=760');
  if (!pop) window.open(href, '_blank', 'noopener,noreferrer');
}

function renderInline(text: string, sources: Source[] | undefined, isAI: boolean) {
  const isCodeRegex = /(\bIS\s+\d+(?:[:\-]\s*\d{2,4})?(?:\s*\(?Part\s*\d+\)?)?\b)/gi;
  const urlRe = /(https?:\/\/[^\s)\]>]+)/gi;
  const mdRe = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  return text.split('**').map((part, i) => {
    const isBold = i % 2 === 1;
    const chunks = part.split(mdRe);
    const rendered = chunks.map((chunk, c) => {
      const md = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(chunk);
      if (md) {
        const href = md[2];
        const allowed = isOfficialUrl(href) || isMapUrl(href);
        if (!allowed) return <React.Fragment key={`${i}-${c}`}>{md[1]}</React.Fragment>;
        return (
          <a
            key={`${i}-${c}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => openExternal(event, href)}
            className="text-blue-700 dark:text-blue-300 underline decoration-blue-300 font-medium"
          >
            {md[1]}
          </a>
        );
      }
      const subParts = chunk.split(isCodeRegex);
      return subParts.map((subPart, j) => {
        if (j % 2 === 1) {
          return (
            <a
              key={`${i}-${c}-${j}`}
              href={officialIsHref(sources)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 underline decoration-orange-300 font-semibold transition-colors mx-0.5"
              title={UI_DICTIONARY[getLangSnapshot()].contextHelper}
            >
              {subPart}
            </a>
          );
        }
        const bits = subPart.split(urlRe);
        return bits.map((bit, k) => {
          if (k % 2 === 1) {
            const href = bit.replace(/[.,;:]+$/, '');
            if ((isOfficialUrl(href) || isMapUrl(href)) && !/google\.com\/search/i.test(href)) {
              return (
                <a
                  key={`${i}-${c}-${j}-${k}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => openExternal(event, href)}
                  className="text-blue-700 dark:text-blue-300 underline break-all"
                >
                  {href}
                </a>
              );
            }
            return <span key={`${i}-${c}-${j}-${k}`}>{bit}</span>;
          }
          return <React.Fragment key={`${i}-${c}-${j}-${k}`}>{bit}</React.Fragment>;
        });
      });
    });
    if (isBold) {
      return <strong key={i} className={!isAI ? 'text-white' : 'text-slate-900 dark:text-slate-50 font-bold'}>{rendered}</strong>;
    }
    return <React.Fragment key={i}>{rendered}</React.Fragment>;
  });
}

function subscribeOnline(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function ChatBotApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [draftFile, setDraftFile] = useState<{ name: string; kind: 'png' | 'image' | 'text'; text?: string; dataUrl?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [, setContextMode] = useState<string>('general');
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForMic, setIsWaitingForMic] = useState(false);
  const language = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const touchStartYRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const scrollHoldRef = useRef(0);
  const unpinnedUntilRef = useRef(0);
  const pinnedTopRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const speechBaseTextRef = useRef<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputTextRef = useRef('');
  inputTextRef.current = inputText;

  useLayoutEffect(() => {
    initTheme();
    initLang();
  }, []);

  useEffect(() => {
    setSessionId(createUniqueId());
    try {
      sessionStorage.removeItem('chat_history');
      sessionStorage.removeItem('chat_context_mode');
      sessionStorage.removeItem('chat_session_id');
    } catch {
      // ignore
    }
  }, []);

  // Network online/offline toast feedback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        setToastMessage(UI_DICTIONARY[language].internetRestored);
        setTimeout(() => setToastMessage(null), 3000);
      };

      window.addEventListener('online', handleOnline);
      return () => {
        window.removeEventListener('online', handleOnline);
      };
    }
  }, [language]);

  // Keep the chat shell flush to the visible screen (no right/bottom empty band on mobile zoom).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const apply = () => {
      const vv = window.visualViewport;
      const scale = vv?.scale ?? 1;
      const w = scale <= 1.02
        ? Math.ceil(vv?.width ?? window.innerWidth)
        : window.innerWidth;
      const h = scale <= 1.02
        ? Math.ceil(vv?.height ?? window.innerHeight)
        : window.innerHeight;
      root.style.setProperty("--mm-vvw", `${w}px`);
      root.style.setProperty("--mm-vvh", `${h}px`);
      root.style.setProperty("--mm-vvt", `${Math.round(vv?.offsetTop ?? 0)}px`);
      root.style.setProperty("--mm-vvl", `${Math.round(vv?.offsetLeft ?? 0)}px`);
    };
    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--mm-vvw");
      root.style.removeProperty("--mm-vvh");
      root.style.removeProperty("--mm-vvt");
      root.style.removeProperty("--mm-vvl");
    };
  }, []);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleListening = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // If currently active, stop immediately
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {
          try {
            recognitionRef.current.abort();
          } catch (__) {}
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      setIsWaitingForMic(false);
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage(UI_DICTIONARY[language].micUnsupported);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // Ensure any previously lingering instance is aborted
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // On mobile devices, continuous=false auto-ends cleanly when user stops speaking
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      // Use localized Indian BCP-47 language tags for highest accuracy
      recognition.lang = speechLang(language);

      // Snapshot the existing input text so spoken words append or update smoothly
      speechBaseTextRef.current = inputText.trim();

      recognition.onstart = () => {
        setIsListening(true);
        setIsWaitingForMic(false);
        setToastMessage(UI_DICTIONARY[language].micListening);
        setTimeout(() => {
          setToastMessage(prev => prev === UI_DICTIONARY[language].micListening ? null : prev);
        }, 2500);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const base = speechBaseTextRef.current;
        const currentSpoken = (finalTranscript || interimTranscript).trim();
        if (currentSpoken) {
          setInputText(base ? `${base} ${currentSpoken}` : currentSpoken);
        }
        if (finalTranscript) {
          speechBaseTextRef.current = (base ? `${base} ${finalTranscript}` : finalTranscript).trim();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        setIsWaitingForMic(false);
        recognitionRef.current = null;

        if (event.error === 'no-speech') {
          setToastMessage(UI_DICTIONARY[language].micNoSpeech);
          setTimeout(() => setToastMessage(null), 3000);
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setToastMessage(UI_DICTIONARY[language].micDenied);
          setTimeout(() => setToastMessage(null), 4000);
        } else if (event.error === 'network') {
          setToastMessage(UI_DICTIONARY[language].micNetworkError);
          setTimeout(() => setToastMessage(null), 3500);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsWaitingForMic(false);
        recognitionRef.current = null;
      };

      setIsWaitingForMic(true);
      // Synchronously call start() within user touch/click gesture event
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition synchronously:", err);
      setIsListening(false);
      setIsWaitingForMic(false);
      recognitionRef.current = null;
      setToastMessage(UI_DICTIONARY[language].micDenied);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const scrollToBottomInstant = () => {
    const el = scrollContainerRef.current;
    if (!el || !stickToBottomRef.current) return;
    if (performance.now() < unpinnedUntilRef.current) return;
    const caret = el.querySelector("[data-mm-caret]");
    if (!(caret instanceof HTMLElement)) return;
    const view = el.getBoundingClientRect();
    const mark = caret.getBoundingClientRect();
    const past = mark.bottom - (view.bottom - 28);
    const above = view.top + 12 - mark.top;
    if (past <= 1 && above <= 1) return;
    programmaticScrollRef.current = true;
    if (past > 1) el.scrollTop += past;
    else el.scrollTop -= above;
    pinnedTopRef.current = el.scrollTop;
    window.clearTimeout(scrollHoldRef.current);
    scrollHoldRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 140);
  };

  const unpin = () => {
    stickToBottomRef.current = false;
    unpinnedUntilRef.current = performance.now() + 800;
    programmaticScrollRef.current = false;
  };

  const onChatWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      unpin();
      return;
    }
    const el = scrollContainerRef.current;
    if (!el || e.deltaY <= 0) return;
    if (performance.now() < unpinnedUntilRef.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) stickToBottomRef.current = true;
  };

  const onChatTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? 0;
  };

  const onChatTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const y = e.touches[0]?.clientY ?? touchStartYRef.current;
    const dy = y - touchStartYRef.current;
    if (dy > 6) unpin();
    else if (dy < -6) {
      const el = scrollContainerRef.current;
      if (el && performance.now() >= unpinnedUntilRef.current && el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
        stickToBottomRef.current = true;
      }
    }
    touchStartYRef.current = y;
  };

  const onChatScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (programmaticScrollRef.current) {
      if (el.scrollTop < pinnedTopRef.current - 2) unpin();
      return;
    }
    if (performance.now() < unpinnedUntilRef.current) {
      stickToBottomRef.current = false;
      return;
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 32) stickToBottomRef.current = false;
  };

  // Centralized scroll follow: react to actual content changes (new messages
  // and each streamed token) instead of a continuously spinning rAF loop.
  // Only auto-follow when the user is pinned to the bottom; if they scrolled
  // up, stickToBottomRef is false and we leave their scroll position alone.
  useLayoutEffect(() => {
    if (stickToBottomRef.current) scrollToBottomInstant();
  }, [messages]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const exportTurns = (): ExportTurn[] =>
    messages.map((message) => ({
      role: message.role === 'ai' ? 'ai' : 'user',
      text: message.text,
      timestamp: message.timestamp,
      sources: message.sources?.map((source) => ({ title: source.title, link: source.link })),
    }));

  const exportConversation = async (kind: 'png' | 'pdf' | 'docx') => {
    setExportOpen(false);
    if (!messages.length) {
      showToast(UI_DICTIONARY[language].shareNoContent);
      return;
    }
    const turns = exportTurns();
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      if (kind === 'png') {
        downloadBytes(await transcriptPng(turns), `ManakMitra-${stamp}.png`, 'image/png');
      } else if (kind === 'pdf') {
        downloadBytes(await transcriptPdf(turns), `ManakMitra-${stamp}.pdf`, 'application/pdf');
      } else {
        downloadBytes(buildDocx(turns), `ManakMitra-${stamp}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }
      showToast(UI_DICTIONARY[language].exported);
    } catch {
      showToast(UI_DICTIONARY[language].exportFailed);
    }
  };

  const shareConversation = async () => {
    if (messages.length === 0) {
      showToast(UI_DICTIONARY[language].shareNoContent);
      return;
    }

    const ui = UI_DICTIONARY[language];
    let shareText = `${ui.shareHeading}\n\n`;
    messages.forEach(msg => {
      const role = msg.role === 'ai' ? 'ManakMitra' : ui.you;
      shareText += `[${msg.timestamp}] ${role}:\n${msg.text}\n\n`;
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title: UI_DICTIONARY[language].shareHeading,
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        showToast(UI_DICTIONARY[language].shareSuccess);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleSend = async (text: string) => {
    const file = draftFile;
    if (!text.trim() && !file) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    stickToBottomRef.current = true;
    unpinnedUntilRef.current = 0;

    if (!isOnline) {
      sendingRef.current = false;
      setToastMessage(UI_DICTIONARY[language].offlineDesc);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    
    // Reply language is only the header dropdown — never auto-switch from the query.
    const replyLang = language;

    const shown = [text.trim(), file ? `Attached: ${file.name}` : ''].filter(Boolean).join('\n');
    const newMsg: Message = {
      id: createUniqueId(),
      role: 'user',
      text: shown,
      timestamp: getFormattedTime()
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setDraftFile(null);
    setIsTyping(true);
    sendingRef.current = true;

    const aiMsgId = createUniqueId();
    const startedAt = Date.now();
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      text: '',
      timestamp: getFormattedTime(),
      isStreaming: true,
      animate: true,
      startedAt,
      userQuery: text,
    }]);

    let labelText: string | undefined;
    if (file && (file.kind === 'png' || file.kind === 'image') && file.dataUrl) {
      const ocrStart = Date.now();
      try {
        const read = await readProductLabel(file.dataUrl);
        labelText = read.text;
        const detail = read.licence
          ? `Saw ${read.licence}`
          : read.isNumber
            ? `Saw IS ${read.isNumber}`
            : read.text
              ? read.text.slice(0, 140)
              : 'No readable licence or IS number';
        setMessages(prev => prev.map((m) => m.id === aiMsgId ? {
          ...m,
          labelLicence: read.licence && /^(CM\/L-|R-)/.test(read.licence) ? read.licence : m.labelLicence,
          workSteps: [...(m.workSteps || []), { id: 'ocr', label: 'Read the label', detail, ms: Date.now() - ocrStart }],
        } : m));
      } catch {
        labelText = '';
        setMessages(prev => prev.map((m) => m.id === aiMsgId ? {
          ...m,
          workSteps: [...(m.workSteps || []), { id: 'ocr', label: 'Read the label', detail: 'The label reader failed', ms: Date.now() - ocrStart }],
        } : m));
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: text, 
          language: replyLang,
          history: messages
            .filter((m) => m.role === 'user' && m.text)
            .slice(-3)
            .map((m) => ({ role: 'user', text: m.text.slice(0, 400) })),
          labelText,
          attachment: file
            ? { name: file.name, kind: file.kind, text: file.text, dataUrl: file.dataUrl }
            : undefined,
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      setIsTyping(false);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let done = false;
      const chunks: string[] = [];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(decoder.decode(value, { stream: true }));
          const accumulatedString = chunks.join('');
          const cut = accumulatedString.endsWith('\n')
            ? accumulatedString.length
            : accumulatedString.lastIndexOf('\n') + 1;
          const pending = accumulatedString.slice(cut);
          const complete = accumulatedString.slice(0, cut);
          
          setMessages(prev => {
            const newMsgs = [...prev];
            const msgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
            if (msgIndex !== -1) {
              const msg = newMsgs[msgIndex];
              const lines = complete.split('\n');
              let pureText = '';
              const sources: Source[] = [];
              const followUps: string[] = [];
              let processSteps: string[] = [];
              const serverSteps: WorkStep[] = [];
              let graph: GraphStop[] | undefined;

              for (const line of lines) {
                const raw = line.trim().replace(/^\*+\s*|\s*\*+$/g, "").trim();
                if (raw.startsWith('[WORK]')) {
                  try {
                    const event = JSON.parse(raw.slice(6)) as { kind?: string; step?: WorkStep; stops?: GraphStop[] };
                    if (event.kind === 'step' && event.step?.id) serverSteps.push(event.step);
                    if (event.kind === 'graph' && Array.isArray(event.stops)) graph = event.stops;
                  } catch {
                    // ignore a broken work line
                  }
                } else if (raw.startsWith('[SOURCE]')) {
                  const parts = raw.replace('[SOURCE]', '').split('|').map(s => s.trim());
                  const link = parts[parts.length - 1] || "";
                  if (parts.length >= 4 && isOfficialUrl(parts[3]) && !/google\.com\/search/i.test(parts[3])) {
                    sources.push({ id: createUniqueId(), title: parts[0], type: parts[1], date: parts[2], link: parts[3] });
                  } else if (isOfficialUrl(link) && !/google\.com\/search/i.test(link)) {
                    sources.push({ id: createUniqueId(), title: parts[0] || "BIS", type: parts[1] || "link", date: parts[2] || "", link });
                  }
                } else if (raw.startsWith('[FOLLOW_UP]')) {
                  const fu = raw.replace('[FOLLOW_UP]', '').trim();
                  if (fu && !isQuestionChip(fu)) followUps.push(fu);
                } else if (raw.startsWith('[META]')) {
                  const parts = raw.replace('[META]', '').split('|').map(s => s.trim());
                  if (parts[0]) msg.confidence = parts[0] as Confidence;
                  if (parts[1]) setContextMode(parts[1]);
                } else if (raw.startsWith('[PROCESS_STEPS]')) {
                  processSteps = raw.replace('[PROCESS_STEPS]', '').split('|').map(s => s.trim()).filter(Boolean)
                    .map((s) => s.replace(/\bakonline\.in\b/gi, 'manakonline.in'))
                    .filter((s) => !/no docs\/fee|instant registration|Apply online as jeweller|Sell only AHC/i.test(s));
                  const consumerVerify = processSteps.some((s) => /CARE|Verify HUID|6-digit HUID/i.test(s));
                  if (consumerVerify) {
                    processSteps = processSteps.filter((s) => !/Register online with BIS|Assaying & Hallmarking Centre|Apply online as jeweller|Sell only AHC/i.test(s));
                  }
                } else {
                  const visible = line.replace(/^\s{0,3}#{1,6}\s+/, '');
                  pureText += visible + '\n';
                }
              }
              if (pending && !pending.trimStart().startsWith('[')) pureText += pending;

              const prior = (msg.workSteps || []).filter((step) => step.id === 'ocr');
              msg.text = pureText.trim();
              msg.isStreaming = !done;
              if (!sourcesBelong(text)) msg.sources = undefined;
              else if (sources.length > 0) msg.sources = sources;
              if (followUps.length > 0) msg.followUpQuestions = followUps;
              if (processSteps.length > 0) msg.processSteps = processSteps;
              if (serverSteps.length) msg.workSteps = [...prior, ...serverSteps];
              if (graph) msg.graph = graph;
            }
            return newMsgs;
          });
        }
      }

      // Safeguard: Ensure message finishes streaming and never ends in blank state
      setMessages(prev => {
        const newMsgs = [...prev];
        const msgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
        if (msgIndex !== -1) {
          const msg = newMsgs[msgIndex];
          msg.isStreaming = false;
          msg.finishedAt = msg.finishedAt || Date.now();
          if (!msg.text || !msg.text.trim()) {
            msg.text = UI_DICTIONARY[replyLang].errorServer;
            msg.confidence = 'low';
            msg.isError = true;
            msg.retryQuery = text;
          } else if (!file) {
            const board = labsFinderResult(text);
            if (board) msg.labBoard = board;
            else if (needsDeviceLocation(text)) msg.askLocation = true;
          }
        }
        return newMsgs;
      });
      const board = !file ? labsFinderResult(text) : null;
      if (board && aiMsgId) {
        const pin = text.match(/(?<!\d)([1-9]\d{5})(?!\d)/)?.[1];
        const body = pin ? { pin } : { lat: board.origin.lat, lng: board.origin.lng };
        void fetch('/api/labs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then((response) => response.json())
          .then((json: { origin?: LabBoard['origin']; nearby?: LabBoard['nearby']; farther?: LabBoard['farther']; mapUrl?: string }) => {
            if (!json.origin || !json.mapUrl) return;
            const origin = json.origin;
            const mapUrl = json.mapUrl;
            const nearby = json.nearby || [];
            const farther = json.farther || [];
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, labBoard: { origin, nearby, farther, mapUrl } } : m)));
          })
          .catch(() => {});
      }
      
    } catch (error) {
      console.error("handleSend Fetch Error:", error);
      setIsTyping(false);
      setMessages(prev => {
        if (aiMsgId) {
          const newMsgs = [...prev];
          const msgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
          if (msgIndex !== -1) {
            newMsgs[msgIndex] = {
              ...newMsgs[msgIndex],
              text: UI_DICTIONARY[replyLang].errorServer,
              confidence: 'low',
              isError: true,
              isStreaming: false,
              finishedAt: Date.now(),
              retryQuery: text
            };
            return newMsgs;
          }
        }
        return [...prev, {
          id: createUniqueId(),
          role: 'ai',
          text: UI_DICTIONARY[replyLang].errorServer,
          timestamp: getFormattedTime(),
          confidence: 'low',
          isError: true,
          isStreaming: false,
          retryQuery: text
        }];
      });
    } finally {
      sendingRef.current = false;
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    const seed = sessionStorage.getItem("mm_seed_query");
    if (!seed?.trim()) return;
    sessionStorage.removeItem("mm_seed_query");
    void handleSend(seed.trim());
    // Landing-page handoff only; chat chrome is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div
      className="relative flex flex-col bg-white text-slate-800 font-sans overflow-hidden min-w-0 min-h-0 z-0 mm-theme-fade dark:bg-[#0c1222] dark:text-slate-100"
      style={{
        position: "fixed",
        top: "var(--mm-vvt, 0px)",
        left: "var(--mm-vvl, 0px)",
        width: "var(--mm-vvw, 100%)",
        height: "var(--mm-vvh, 100dvh)",
      }}
    >
      <SiteHeader
        variant="chat"
        trailing={
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                onClick={() => setExportOpen((open) => !open)}
                className="inline-flex h-11 items-center gap-1.5 rounded border border-line px-3 text-sm font-medium text-ink hover:bg-paper dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#151d30]"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{UI_DICTIONARY[language].exportLabel}</span>
              </button>
              {exportOpen ? (
                <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-[#151d30]">
                  {([
                    ['png', 'PNG'],
                    ['pdf', 'PDF'],
                    ['docx', 'Word'],
                  ] as const).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => void exportConversation(kind)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#1c2640]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              aria-label={UI_DICTIONARY[language].shareConversation}
              onClick={shareConversation}
              className="inline-flex h-11 w-11 items-center justify-center rounded border border-line text-ink hover:bg-paper dark:border-slate-600 dark:text-slate-300 dark:hover:bg-[#151d30]"
              title={UI_DICTIONARY[language].shareConversation}
            >
              <Share className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 sm:top-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:w-auto sm:max-w-md sm:transform sm:-translate-x-1/2 z-[60] bg-slate-800 text-white px-3 py-2 rounded-full shadow-lg text-xs sm:text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 max-w-[calc(100%-1.5rem)] mx-auto">
          <Info className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden w-full min-w-0 relative">
        {/* Chat Area */}
        <div className={`flex-1 flex flex-col min-h-0 h-full bg-white relative min-w-0 max-w-full overflow-hidden mm-theme-fade dark:bg-[#0c1222] ${messages.length === 0 ? 'justify-center' : ''}`}>
          
          {/* Offline / Limited Connectivity Banner */}
          {!isOnline && (
            <div 
              role="status" 
              aria-live="polite"
              className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs sm:text-sm text-amber-900 flex items-center justify-between gap-3 shrink-0 z-30 animate-in fade-in slide-in-from-top-1 duration-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded-md bg-amber-100 text-amber-800 shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 truncate">
                  <span className="font-semibold text-amber-950">
                    {UI_DICTIONARY[language].offlineTitle}:
                  </span>
                  <span className="text-amber-800 text-xs sm:text-sm truncate">
                    {UI_DICTIONARY[language].offlineDesc}
                  </span>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-200/70 text-amber-900 border border-amber-300 shrink-0">
                {UI_DICTIONARY[language].cachedHistoryBadge}
              </span>
            </div>
          )}

          {/* Scrollable messages area */}
          <div 
            id="mm-main"
            ref={scrollContainerRef}
            data-mm-chat-scroll=""
            onScroll={onChatScroll}
            onWheel={onChatWheel}
            onTouchStart={onChatTouchStart}
            onTouchMove={onChatTouchMove}
            className={messages.length === 0
              ? "flex flex-col items-center justify-center px-3 py-6 sm:px-6"
              : "flex-1 min-h-0 overflow-y-auto overflow-x-clip px-2.5 py-2.5 sm:p-6 lg:p-8 relative overscroll-y-contain touch-pan-y [overflow-anchor:none] [scroll-behavior:auto]"}
          >
              {messages.length === 0 ? (
               <WelcomeState language={language} />
             ) : (
               <div className="max-w-4xl mx-auto w-full min-w-0 space-y-3 sm:space-y-6">
                 {/* ARIA Live Region for screen readers */}
                 <div className="sr-only" aria-live="polite" aria-atomic="true">
                   {messages.length > 0 && messages[messages.length - 1].role === 'ai' ? messages[messages.length - 1].text : ''}
                 </div>
                 
                 {messages.map((msg, index) => (
                   <MessageBubble 
                     key={msg.id} 
                     msg={msg} 
                     language={language}
                     onFollow={scrollToBottomInstant}
                    onVote={(vote) => {
                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, vote } : m));
                    }}
                     onRetry={
                       msg.isError && msg.retryQuery 
                         ? () => {
                             // Remove the error message and the previous user message
                             setMessages(prev => prev.filter((_, i) => i !== index && i !== index - 1));
                             handleSend(msg.retryQuery!);
                           }
                         : undefined
                     }
                     onUseLocation={
                       msg.askLocation
                         ? () => {
                             const ui = deskUi(language);
                             if (!navigator.geolocation) {
                               setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, locationError: ui.errNoGeo } : m));
                               return;
                             }
                             setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, locationBusy: true, locationError: undefined } : m));
                             navigator.geolocation.getCurrentPosition(
                               (pos) => {
                                 void (async () => {
                                   try {
                                     const response = await fetch('/api/labs', {
                                       method: 'POST',
                                       headers: { 'Content-Type': 'application/json' },
                                       body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                     });
                                     const json = await response.json() as {
                                       error?: string;
                                       origin?: { lat: number; lng: number; label: string };
                                       nearby?: RankedLab[];
                                       farther?: RankedLab[];
                                       mapUrl?: string;
                                     };
                                     if (!response.ok || !json.origin || !json.mapUrl) throw new Error(json.error || 'labs');
                                     const origin = json.origin;
                                     const mapUrl = json.mapUrl;
                                     const nearby = json.nearby || [];
                                     const farther = json.farther || [];
                                     const closest = nearby[0] || farther[0];
                                     const lines = closest
                                       ? `${nearby.length ? ui.nearYes : ui.nearNo}. ${closest.name}, ${closest.km} km.`
                                       : ui.errLabs;
                                     setMessages(prev => [
                                       ...prev.map(m => m.id === msg.id ? { ...m, locationBusy: false, askLocation: false } : m),
                                       {
                                         id: createUniqueId(),
                                         role: 'ai' as const,
                                         text: lines,
                                         timestamp: getFormattedTime(),
                                         confidence: nearby.some((lab) => lab.confidence === 'high') ? 'high' as const : 'low' as const,
                                         labBoard: {
                                           origin,
                                           nearby,
                                           farther,
                                           mapUrl,
                                         },
                                       },
                                     ]);
                                   } catch {
                                     setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, locationBusy: false, locationError: ui.errLabs } : m));
                                   }
                                 })();
                               },
                               () => {
                                 setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, locationBusy: false, locationError: ui.errGeoDenied } : m));
                               },
                               { enableHighAccuracy: true, timeout: 8000 },
                             );
                           }
                         : undefined
                     }
                   />
                 ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
          </div>
          
          {/* Input Area (Fixed Bottom) */}
          <div className={messages.length === 0
            ? "mx-auto w-full max-w-3xl px-3 pb-8"
            : "w-full min-w-0 px-2.5 pt-2 sm:p-4 bg-white shrink-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] mm-theme-fade dark:bg-[#0c1222]"}>
            {(() => {
              const lastAi = [...messages].reverse().find((m) => m.role === 'ai');
              const chips = isTyping ? [] : suggestionChips(lastAi, language);
              if (!chips.length) return null;
              return (
                <div className="max-w-4xl mx-auto mb-2 flex flex-wrap gap-1.5 motion-reduce:transition-none motion-reduce:animate-none">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSend(chip)}
                      className="max-w-full px-3 py-1.5 rounded-full border border-slate-300 bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 transition-colors mm-break text-left dark:border-slate-600 dark:bg-[#151d30] dark:text-slate-200 dark:hover:bg-[#1c2640] dark:hover:border-blue-400/40 dark:hover:text-blue-200"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              );
            })()}
            {language === 'en' && /[\u0900-\u097F]/.test(inputText) ? (
              <div className="max-w-4xl mx-auto mb-2">
                <button
                  type="button"
                  data-hindi-nudge=""
                  onClick={() => setLang('hi')}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  हिंदी में जवाब चाहिए?
                </button>
              </div>
            ) : null}
            <form
              className="relative mx-auto w-full max-w-3xl"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputTextRef.current);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,text/plain"
                className="sr-only"
                aria-label={UI_DICTIONARY[language].attach}
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  if (!picked) return;
                  void (async () => {
                    const ext = picked.name.split('.').pop()?.toLowerCase() ?? '';
                    const image = picked.type === 'image/png' || picked.type === 'image/jpeg' || picked.type === 'image/webp' || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
                    if (image) {
                      const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ''));
                        reader.onerror = () => reject(new Error('read'));
                        reader.readAsDataURL(picked);
                      });
                      const kind = picked.type === 'image/png' || ext === 'png' ? 'png' : 'image';
                      const parsed = parseAttachment({ name: picked.name, kind, dataUrl });
                      if (!parsed.ok || !parsed.attachment || (parsed.attachment.kind !== 'png' && parsed.attachment.kind !== 'image')) {
                        setToastMessage(UI_DICTIONARY[language].pngReadError);
                        setTimeout(() => setToastMessage(null), 3500);
                        return;
                      }
                      setDraftFile({ name: parsed.attachment.name, kind: parsed.attachment.kind, dataUrl: parsed.attachment.dataUrl });
                      return;
                    }
                    const text = await picked.text();
                    const parsed = parseAttachment({ name: picked.name, kind: 'text', text });
                    if (!parsed.ok || !parsed.attachment || parsed.attachment.kind !== 'text') {
                      setToastMessage(UI_DICTIONARY[language].fileType);
                      setTimeout(() => setToastMessage(null), 3500);
                      return;
                    }
                    setDraftFile({ name: parsed.attachment.name, kind: 'text', text: parsed.attachment.text });
                  })().catch(() => {
                    setToastMessage(UI_DICTIONARY[language].pngReadError);
                    setTimeout(() => setToastMessage(null), 3500);
                  });
                }}
              />
              <div className={`relative overflow-hidden rounded-3xl border bg-slate-50 transition-colors dark:bg-[#201f1d] ${isTyping ? 'border-blue-300 opacity-80' : 'border-slate-200 dark:border-white/10'} ${isListening ? 'border-red-400' : ''}`}>
                {isWaitingForMic && (
                  <div className="absolute -top-8 left-0 right-0 flex justify-center">
                    <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-sm animate-pulse">
                      {UI_DICTIONARY[language].micWaiting}
                    </span>
                  </div>
                )}
                {isListening && (
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-red-50/90 border-b border-red-200/80 rounded-t-2xl text-xs text-red-700 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                      </span>
                      <span className="font-semibold">{UI_DICTIONARY[language].micListening}</span>
                    </div>
                    <button 
                      type="button"
                      onClick={toggleListening}
                      className="text-red-700 hover:text-red-900 font-bold underline text-[11px] px-1 py-0.5"
                    >
                      {UI_DICTIONARY[language].stopDone}
                    </button>
                  </div>
                )}
                {draftFile && (
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-[#1c2640] dark:text-slate-200">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{draftFile.name}</span>
                      <button type="button" aria-label={`Remove ${draftFile.name}`} onClick={() => setDraftFile(null)} className="ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                )}
                <textarea 
                  ref={inputRef}
                  aria-label={UI_DICTIONARY[language].composerPlaceholder}
                  value={inputText}
                  autoFocus
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
                    if (isEnter && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSend(inputTextRef.current || (e.currentTarget as HTMLTextAreaElement).value);
                    }
                  }}
                  placeholder={isListening ? UI_DICTIONARY[language].listeningPlaceholder : UI_DICTIONARY[language].composerPlaceholder}
                  className="w-full bg-transparent px-4 pt-3.5 pb-14 focus:outline-none resize-none max-h-40 min-h-[88px] text-base leading-7 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  rows={1}
                  dir="auto"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
                  <button
                    type="button"
                    aria-label={UI_DICTIONARY[language].attach}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      aria-label={isListening ? UI_DICTIONARY[language].stopDone : UI_DICTIONARY[language].speakTitle}
                      onClick={toggleListening}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={isWaitingForMic}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                        isListening ? 'bg-red-600 text-white' : 
                        isWaitingForMic ? 'text-slate-300 cursor-not-allowed dark:text-slate-600' :
                        'text-slate-500 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-white/10'
                      }`}
                      title={isListening ? UI_DICTIONARY[language].stopDone : UI_DICTIONARY[language].speakTitle}
                    >
                      {isListening ? (
                        <span className="flex items-end justify-center gap-[2px] h-4">
                          <span className="w-[3px] bg-white h-2 animate-[bounce_1s_infinite_0ms] rounded-full"></span>
                          <span className="w-[3px] bg-white h-4 animate-[bounce_1s_infinite_200ms] rounded-full"></span>
                          <span className="w-[3px] bg-white h-3 animate-[bounce_1s_infinite_400ms] rounded-full"></span>
                        </span>
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>
                    <button 
                      type="submit"
                      aria-label={UI_DICTIONARY[language].sendLabel}
                      disabled={!inputText.trim() && !draftFile}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${inputText.trim() || draftFile ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900' : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-white/10 dark:text-slate-500'}`}
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-slate-500 dark:text-slate-400">
              {UI_DICTIONARY[language].privacyHint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub Components ---

const WelcomeState = ({ language }: { language: AppLang }) => (
  <div className="mx-auto mb-6 flex w-full max-w-3xl flex-col items-center px-1">
    <div className="mb-4 flex h-14 w-14 items-center justify-center">
      <ManakMark className="h-14 w-14 rounded-full shadow-md" />
    </div>
    <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
      {UI_DICTIONARY[language].welcomeTitle}
    </h1>
    <p className="mt-2 max-w-xl text-center text-sm text-slate-600 sm:text-base dark:text-slate-300">
      {UI_DICTIONARY[language].welcomeDesc}
    </p>
  </div>
);

function ChatLabMap({ board, language }: { board: LabBoard; language: AppLang }) {
  const t = deskUi(language);
  const pool = board.nearby.length ? board.nearby.slice(0, 3) : board.farther.slice(0, 1);
  const [picked, setPicked] = useState(pool[0]?.id ?? '');
  const selected = pool.find((lab) => lab.id === picked) || pool[0];
  if (!selected) return null;
  return (
    <div className="mt-4 w-full min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {t.fromPlace} {board.origin.label}
      </p>
      <iframe
        key={selected.id}
        title={selected.name}
        src={mapsEmbedUrl(selected, board.origin)}
        className="h-56 w-full rounded-2xl border border-slate-200 bg-white sm:h-72 dark:border-slate-700"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <ul className="mt-3 grid gap-2">
        {pool.map((lab) => (
          <li key={lab.id}>
            <button
              type="button"
              onClick={() => setPicked(lab.id)}
              className={`w-full rounded-2xl border px-3 py-2.5 text-left ${picked === lab.id ? 'border-bis-navy' : 'border-slate-200 dark:border-slate-600'}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-900 dark:text-slate-50">{lab.name}</span>
                <span className="shrink-0 text-sm text-bis-navy dark:text-blue-300">{lab.km} km</span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{lab.address}</span>
              <span className={`mt-1 inline-flex text-xs font-semibold ${lab.confidence === 'high' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {lab.confidence === 'high' ? t.bisLab : t.cityList}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <a href={mapsSearchUrl(selected)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-300">
        {t.openMaps}
      </a>
    </div>
  );
}

const MessageBubble = ({ msg, language, onFollow, onRetry, onUseLocation, onVote }: { msg: Message, language: AppLang, onFollow?: () => void, onRetry?: () => void, onUseLocation?: () => void, onVote?: (vote: 'up' | 'down') => void }) => {
  const isAI = msg.role === 'ai';
  const [copied, setCopied] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [reported, setReported] = useState(false);

  async function sendDeskFeedback(kind: 'up' | 'down' | 'report') {
    if (feedbackBusy) return;
    if (kind === 'up' || kind === 'down') onVote?.(kind);
    if (kind === 'report') setReported(true);
    const exitStep = (msg.workSteps || []).find((step) => step.id === 'exit' || step.id === 'refuse');
    setFeedbackBusy(true);
    setFeedbackNote('Saving for 24 hours…');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          query: msg.userQuery || '',
          locks: (msg.workSteps || []).slice(0, 8).map((step) => ({ id: step.id, label: step.label, detail: step.detail })),
          evidence: (msg.sources || [])
            .filter((s) => isOfficialUrl(s.link))
            .slice(0, 6)
            .map((s) => ({ title: s.title, url: s.link })),
          exit: exitStep?.detail || '',
          language,
        }),
      });
      if (res.ok) setFeedbackNote('Saved for 24 hours. Not sent to BIS.');
      else if (res.status === 429) setFeedbackNote('Too many clicks. Wait a minute.');
      else setFeedbackNote('Not saved. Try again.');
    } catch {
      setFeedbackNote('Not saved. Try again.');
    } finally {
      setFeedbackBusy(false);
    }
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const shouldType = isAI && !msg.isError && (msg.animate || msg.isStreaming);
  const [shown, setShown] = useState(() => (shouldType ? '' : msg.text));

  useEffect(() => {
    if (!shouldType) {
      setShown(msg.text);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(msg.text);
      return;
    }
    const timer = window.setInterval(() => {
      setShown((cur) => {
        const text = msg.text;
        const base = text.startsWith(cur) ? cur.length : 0;
        if (base >= text.length) {
          if (!msg.isStreaming) window.clearInterval(timer);
          return text;
        }
        const gap = text.length - base;
        const step = gap > 280 ? 8 : gap > 90 ? 4 : 2;
        return text.slice(0, base + step);
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [msg.text, msg.isStreaming, shouldType]);

  const followRef = useRef(onFollow);
  followRef.current = onFollow;

  useLayoutEffect(() => {
    if (!shouldType) return;
    followRef.current?.();
  }, [shown, shouldType]);

  const caughtUp = shown.length >= msg.text.length;
  const isActivelyTyping = shouldType && (!caughtUp || msg.isStreaming);
  const isFinishedTyping = !msg.isStreaming && caughtUp;
  const displayedText = shouldType ? shown : msg.text;

  const [spoken, setSpoken] = useState<{ start: number; end: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const stopSpeak = useRef<(() => void) | null>(null);
  const speakBusy = useRef(false);

  useEffect(() => () => stopSpeak.current?.(), []);

  function toggleSpeak() {
    if (speakBusy.current) {
      stopSpeak.current?.();
      return;
    }
    const text = msg.text;
    if (!text.trim()) return;
    const synth = window.speechSynthesis;
    const tag = voiceTag(language);
    let cancelled = false;
    const audioBox: { current: HTMLAudioElement | null } = { current: null };
    const stop = () => {
      cancelled = true;
      speakBusy.current = false;
      audioBox.current?.pause();
      if (synth?.speaking) synth.cancel();
      setSpeaking(false);
      setSpoken(null);
    };
    stopSpeak.current = stop;
    speakBusy.current = true;
    setSpeaking(true);

    const finish = () => {
      if (cancelled) return;
      speakBusy.current = false;
      setSpeaking(false);
      setSpoken(null);
    };

    const speakLocal = (voice: SpeechSynthesisVoice | null) => {
      if (!synth) {
        finish();
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = tag;
      utter.rate = 0.96;
      if (voice) utter.voice = voice;
      utter.onboundary = (event) => {
        if (cancelled) return;
        if (event.name && event.name !== "word") return;
        setSpoken(spokenSlice(text, event.charIndex || 0, event.charLength || 0));
      };
      utter.onend = finish;
      utter.onerror = finish;
      synth.speak(utter);
    };

    const speakRemote = async () => {
      for (const chunk of speechChunks(text)) {
        if (cancelled) return;
        const piece = text.slice(chunk.start, chunk.end).trim();
        if (!piece) continue;
        setSpoken(chunk);
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang: language, text: piece }),
        });
        if (!res.ok) throw new Error("voice");
        const url = URL.createObjectURL(await res.blob());
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          audioBox.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("audio"));
          };
          audio.ontimeupdate = () => {
            if (cancelled || !audio.duration) return;
            const at = chunk.start + Math.floor((chunk.end - chunk.start) * (audio.currentTime / audio.duration));
            setSpoken(spokenSlice(text, at, 1));
          };
          audio.play().catch(reject);
        });
      }
      finish();
    };

    void (async () => {
      const voices = await loadVoices();
      if (cancelled) return;
      const voice = pickVoice(voices, tag);
      if (voice && synth) {
        speakLocal(voice);
        return;
      }
      try {
        await speakRemote();
      } catch {
        finish();
      }
    })();
  }

  const handleCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg.text).catch(err => {
        console.error("Clipboard copy failed:", err);
      });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div ref={rootRef} className={`flex gap-2 sm:gap-4 min-w-0 w-full ${!isAI ? 'flex-row-reverse' : ''}`}>
      {isAI && (
        msg.isError ? (
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-100 sm:mt-1 sm:h-8 sm:w-8 dark:border-red-800 dark:bg-red-950/50">
            <X className="h-3.5 w-3.5 text-red-700 sm:h-5 sm:w-5 dark:text-red-300" />
          </div>
        ) : (
          <ManakMark className="mt-0.5 h-6 w-6 shrink-0 rounded-full sm:mt-1 sm:h-8 sm:w-8" />
        )
      )}
      
      <div className={`min-w-0 max-w-[92%] sm:max-w-[90%] md:max-w-[85%] flex flex-col ${!isAI ? 'items-end' : 'items-start'}`}>
        <div className={`p-3 sm:p-5 rounded-2xl shadow-sm relative group min-w-0 max-w-full overflow-hidden ${
          !isAI 
            ? 'bg-bis-navy text-white rounded-tr-sm border border-bis-navy-deep' 
            : msg.isError
            ? 'bg-red-50 text-red-800 rounded-tl-sm border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
            : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-200 dark:bg-[#151d30] dark:text-slate-100 dark:border-slate-700'
        }`}>
          {isAI && !msg.isError && msg.startedAt ? (
            <WorkPanel
              startedAt={msg.startedAt}
              finishedAt={msg.finishedAt}
              steps={msg.workSteps || []}
              stops={msg.graph}
            />
          ) : null}
          {/* Main Text */}
          {!displayedText && isAI && !msg.isError ? (
            <div data-mm-caret="" className="flex items-center gap-2 py-1 text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {UI_DICTIONARY[language].writingResponse}
              </span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-snug sm:leading-relaxed text-[13px] sm:text-[15px] mm-break">
              {speaking && spoken ? (
                <>
                  {renderInline(displayedText.slice(0, spoken.start), msg.sources, isAI)}
                  <mark data-reading="" className="rounded-sm bg-amber-200/90 text-inherit dark:bg-amber-400/30">
                    {displayedText.slice(spoken.start, spoken.end)}
                  </mark>
                  {renderInline(displayedText.slice(spoken.end), msg.sources, isAI)}
                </>
              ) : (
                renderInline(displayedText, msg.sources, isAI)
              )}
              {/* Natural glowing typing cursor while streaming */}
              {isActivelyTyping && !isFinishedTyping && displayedText.length > 0 && (
                <span
                  data-mm-caret=""
                  className="inline-block w-2 h-4 ml-1 -mb-0.5 align-middle bg-blue-600 rounded-[1px] animate-pulse motion-reduce:animate-none" 
                  style={{ animationDuration: '650ms' }}
                  aria-hidden="true"
                />
              )}
            </div>
          )}
          
          {/* Confidence Badge */}
          {msg.confidence && (isFinishedTyping || !isAI) && (
            <div className="mt-4 flex items-center animate-in fade-in duration-300">
              <span className={`inline-flex items-center max-w-full px-2 py-1 sm:px-2.5 rounded-md text-[11px] sm:text-xs font-bold border cursor-help whitespace-normal ${
                msg.confidence === 'high' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-200 dark:border-green-800' :
                msg.confidence === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800' :
                'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800'
              }`} title={UI_DICTIONARY[language].confidenceHint}>
                {msg.confidence === 'high' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'medium' && <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'low' && <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'high' ? UI_DICTIONARY[language].highConf :
                 msg.confidence === 'medium' ? UI_DICTIONARY[language].medConf :
                 UI_DICTIONARY[language].lowConf}
              </span>
            </div>
          )}
          
          {msg.labBoard && isFinishedTyping && !msg.isError ? (
            <ChatLabMap board={msg.labBoard} language={language} />
          ) : null}

          {msg.askLocation && onUseLocation && isFinishedTyping && !msg.isError && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onUseLocation}
                disabled={msg.locationBusy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold mm-press hover:border-bis-navy disabled:opacity-60 dark:border-slate-600"
              >
                <MapPin className="h-4 w-4" />
                {msg.locationBusy ? deskUi(language).finding : deskUi(language).useDevice}
              </button>
              {msg.locationError ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{msg.locationError}</p> : null}
            </div>
          )}

          {msg.isError && onRetry && (
            <div className="mt-4 flex">
              <button 
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >
                <RotateCcw className="w-4 h-4" />
                {UI_DICTIONARY[language].retry}
              </button>
            </div>
          )}

          {isFinishedTyping && msg.processSteps && msg.processSteps.length > 0 && (
            <ol className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 w-full min-w-0 space-y-2">
              {msg.processSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-700 dark:bg-blue-950/70 dark:border-blue-400 dark:text-blue-200">{idx + 1}</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug mm-break">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {isAI && isFinishedTyping && !msg.isError ? (
            <div className="mt-3 space-y-2">
              <p data-pack-verified={PACK_VERIFIED} className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Pack verified: {PACK_VERIFIED}
                <span className="mt-0.5 block">QCO status is not in this pack. Re-check the live BIS portal.</span>
              </p>
              {msg.labelLicence ? (
                <div data-label-route="" className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <p>Extracted {msg.labelLicence} from the photo. Not verified.</p>
                  <p className="mt-1 text-xs text-slate-500">Route this to BIS CARE. This desk does not check the register.</p>
                  <p className="mt-2 flex flex-wrap gap-3">
                    <a className="font-semibold text-blue-700 underline dark:text-blue-300" href={MORE_URL.complaint}>BIS complaint page</a>
                    <a className="font-semibold text-blue-700 underline dark:text-blue-300" href="mailto:complaints@bis.gov.in">complaints@bis.gov.in</a>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Source card only when this question is a BIS fact. */}
          {isFinishedTyping && sourcesBelong(msg.userQuery || "") && msg.sources && msg.sources.filter((s) => isOfficialUrl(s.link) && !/google\.com\/search/i.test(s.link)).length > 0 && (
            <div className="mt-4 sm:mt-5 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm min-w-0 dark:bg-[#10182a] dark:border-slate-700">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                {UI_DICTIONARY[language].sources} ({msg.sources.filter((s) => isOfficialUrl(s.link) && !/google\.com\/search/i.test(s.link)).length} {UI_DICTIONARY[language].documents})
              </h4>
              <ul className="space-y-3">
                {msg.sources.filter((s) => isOfficialUrl(s.link) && !/google\.com\/search/i.test(s.link)).map(s => (
                  <li key={s.id} className="group">
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-300 font-semibold text-sm hover:underline flex items-start gap-1.5 min-w-0">
                      <span className="mt-0.5 mm-break">{s.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider dark:bg-slate-800 dark:text-slate-300">{s.type}</span>
                      <span className="text-xs text-slate-500 font-medium dark:text-slate-400">{s.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {isAI && isFinishedTyping && !msg.isError ? (
          <div data-answer-actions="" className="mt-1 flex items-center gap-0.5">
            <button type="button" onClick={handleCopy} aria-label={UI_DICTIONARY[language].copyLabel} title={UI_DICTIONARY[language].copyLabel} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
            <button type="button" aria-pressed={msg.vote === 'up'} disabled={feedbackBusy} onClick={() => void sendDeskFeedback('up')} aria-label="Useful" title="Useful" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 disabled:opacity-40 aria-pressed:text-bis-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:aria-pressed:text-slate-100">
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button type="button" aria-pressed={msg.vote === 'down'} disabled={feedbackBusy} onClick={() => void sendDeskFeedback('down')} aria-label="Not useful" title="Not useful" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 disabled:opacity-40 aria-pressed:text-bis-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:aria-pressed:text-slate-100">
              <ThumbsDown className="h-4 w-4" />
            </button>
            <button type="button" data-report-wrong="" aria-pressed={reported} disabled={feedbackBusy} onClick={() => void sendDeskFeedback('report')} aria-label="Report wrong answer" title="Report wrong answer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 disabled:opacity-40 aria-pressed:text-red-700 dark:text-slate-400 dark:hover:bg-slate-800">
              <Flag className="h-4 w-4" />
            </button>
            <button type="button" data-read-aloud="" aria-pressed={speaking} onClick={toggleSpeak} aria-label={readAloudLabel(language)} title={readAloudLabel(language)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 aria-pressed:text-bis-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:aria-pressed:text-amber-200">
              {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
            </button>
            {feedbackNote ? (
              <p data-feedback-note="" className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">{feedbackNote}</p>
            ) : null}
          </div>
        ) : null}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 mx-1 font-medium">{msg.timestamp}</span>
      </div>
    </div>
  );
};

