'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { 
  FileText, 
  Send, Mic, CheckCircle, 
  AlertTriangle, XCircle, ExternalLink, X,
  Info, Copy, Check, Share, RotateCcw, WifiOff
} from 'lucide-react';
import { speechLang, UI_DICTIONARY, type AppLang } from '@/lib/language';
import { initTheme } from '@/lib/theme';
import ManakMark from '@/components/manak-mark';
import {
  subscribeLang,
  getLangSnapshot,
  getLangServerSnapshot,
  initLang,
} from '@/lib/lang-store';
import SiteHeader from '@/components/site-header';

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

const DEFAULT_REC_CHIPS = [
  "Verify HUID on gold jewellery",
  "ISI licence for cement",
  "CRS registration for laptops",
];

function suggestionChips(msg: Message | undefined): string[] {
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
  if (!msg.sources?.length) return DEFAULT_REC_CHIPS;
  return [];
}

function renderInline(text: string, sources: Source[] | undefined, isAI: boolean) {
  const isCodeRegex = /(\bIS\s+\d+(?:[:\-]\s*\d{2,4})?(?:\s*\(?Part\s*\d+\)?)?\b)/gi;
  const urlRe = /(https?:\/\/[^\s)\]>]+)/gi;
  return text.split('**').map((part, i) => {
    const isBold = i % 2 === 1;
    const subParts = part.split(isCodeRegex);
    const rendered = subParts.map((subPart, j) => {
      if (j % 2 === 1) {
        return (
          <a
            key={j}
            href={officialIsHref(sources)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 underline decoration-orange-300 font-semibold transition-colors mx-0.5"
            title="Open official BIS catalogue for this Indian Standard"
          >
            {subPart}
          </a>
        );
      }
      const bits = subPart.split(urlRe);
      return bits.map((bit, k) => {
        if (k % 2 === 1) {
          const href = bit.replace(/[.,;:]+$/, '');
          if (isOfficialUrl(href) && !/google\.com\/search/i.test(href)) {
            return (
              <a
                key={`${j}-${k}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-300 underline break-all"
              >
                {href}
              </a>
            );
          }
          return <span key={`${j}-${k}`}>{bit}</span>;
        }
        return <React.Fragment key={`${j}-${k}`}>{bit}</React.Fragment>;
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
  const [isTyping, setIsTyping] = useState(false);
  const [, setContextMode] = useState<string>('general');
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForMic, setIsWaitingForMic] = useState(false);
  const language = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const touchStartYRef = useRef(0);
  const programmaticScrollRef = useRef(false);
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
        setToastMessage(language === 'hi' ? 'इंटरनेट कनेक्शन पुनः सक्रिय हो गया है।' : 'Internet connection restored.');
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
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
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

  const pinToBottom = () => {
    stickToBottomRef.current = true;
    const el = scrollContainerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    programmaticScrollRef.current = false;
  };

  const onChatWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      stickToBottomRef.current = false;
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) {
      stickToBottomRef.current = true;
    }
  };

  const onChatTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? 0;
  };

  const onChatTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const y = e.touches[0]?.clientY ?? touchStartYRef.current;
    if (y - touchStartYRef.current > 8) {
      stickToBottomRef.current = false;
    }
    touchStartYRef.current = y;
  };

  const onChatScroll = () => {
    if (programmaticScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const followStream = isTyping || Boolean(messages[messages.length - 1]?.isStreaming);

  // Follow tokens only while pinned. Instant scrollTop — never CSS smooth.
  useEffect(() => {
    if (!followStream) {
      if (stickToBottomRef.current) pinToBottom();
      return;
    }
    let raf = 0;
    const tick = () => {
      if (stickToBottomRef.current) {
        const el = scrollContainerRef.current;
        if (el) {
          programmaticScrollRef.current = true;
          el.scrollTop = el.scrollHeight;
          programmaticScrollRef.current = false;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [followStream]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const shareConversation = async () => {
    if (messages.length === 0) {
      showToast(UI_DICTIONARY[language].shareNoContent);
      return;
    }

    let shareText = "ManakMitra BIS Assistant Conversation\n\n";
    messages.forEach(msg => {
      const role = msg.role === 'ai' ? 'ManakMitra' : 'User';
      shareText += `[${msg.timestamp}] ${role}:\n${msg.text}\n\n`;
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ManakMitra Conversation',
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
    if (!text.trim()) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    stickToBottomRef.current = true;

    if (!isOnline) {
      sendingRef.current = false;
      setToastMessage(UI_DICTIONARY[language].offlineDesc);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    
    // Reply language is only the header dropdown — never auto-switch from the query.
    const replyLang = language;

    const newMsg: Message = {
      id: createUniqueId(),
      role: 'user',
      text,
      timestamp: getFormattedTime()
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setIsTyping(true);
    sendingRef.current = true;

    const aiMsgId = createUniqueId();
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      text: '',
      timestamp: getFormattedTime(),
      isStreaming: true,
      animate: true
    }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: text, 
          language: replyLang,
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
          
          setMessages(prev => {
            const newMsgs = [...prev];
            const msgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
            if (msgIndex !== -1) {
              const msg = newMsgs[msgIndex];
              const lines = accumulatedString.split('\n');
              let pureText = '';
              const sources: Source[] = [];
              const followUps: string[] = [];
              let processSteps: string[] = [];

              for (const line of lines) {
                const raw = line.trim().replace(/^\*+\s*|\s*\*+$/g, "").trim();
                if (raw.startsWith('[SOURCE]')) {
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

              msg.text = pureText.trim();
              msg.isStreaming = !done;
              if (sources.length > 0) msg.sources = sources;
              if (followUps.length > 0) msg.followUpQuestions = followUps;
              if (processSteps.length > 0) msg.processSteps = processSteps;
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
          if (!msg.text || !msg.text.trim()) {
            msg.text = UI_DICTIONARY[replyLang].errorServer;
            msg.confidence = 'low';
            msg.isError = true;
            msg.retryQuery = text;
          }
        }
        return newMsgs;
      });
      
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
          <button
            aria-label={UI_DICTIONARY[language].shareConversation}
            onClick={shareConversation}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-[#151d30]"
            title={UI_DICTIONARY[language].shareConversation}
          >
            <Share className="w-5 h-5" />
          </button>
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
        <div className="flex-1 flex flex-col min-h-0 h-full bg-white relative min-w-0 max-w-full overflow-hidden mm-theme-fade dark:bg-[#0c1222]">
          
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
            id="chat-scroll-container"
            ref={scrollContainerRef}
            onScroll={onChatScroll}
            onWheel={onChatWheel}
            onTouchStart={onChatTouchStart}
            onTouchMove={onChatTouchMove}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-clip px-2.5 py-2.5 sm:p-6 lg:p-8 relative overscroll-y-contain touch-pan-y [overflow-anchor:none] [scroll-behavior:auto]"
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
                     onRetry={
                       msg.isError && msg.retryQuery 
                         ? () => {
                             // Remove the error message and the previous user message
                             setMessages(prev => prev.filter((_, i) => i !== index && i !== index - 1));
                             handleSend(msg.retryQuery!);
                           }
                         : undefined
                     }
                   />
                 ))}
                 
                  {isTyping && (
                    <div className="flex items-start gap-2 sm:gap-4 animate-in fade-in min-w-0">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 dark:bg-[#151d30] dark:border-slate-600">
                        <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 bg-slate-200 dark:bg-slate-600 rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0 max-w-2xl bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm space-y-3 sm:space-y-4 dark:bg-[#151d30] dark:border-slate-700">
                        <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/4 animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-full animate-pulse"></div>
                          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-full animate-pulse"></div>
                          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-5/6 animate-pulse"></div>
                        </div>
                        <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded w-32 animate-pulse mt-4"></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
          </div>
          
          {/* Input Area (Fixed Bottom) */}
          <div className="w-full min-w-0 px-2.5 pt-2 sm:p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] mm-theme-fade dark:bg-[#0c1222] dark:border-slate-700 dark:shadow-none">
            {(() => {
              const lastAi = [...messages].reverse().find((m) => m.role === 'ai');
              const chips = isTyping ? [] : suggestionChips(lastAi);
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
            <form
              className="max-w-4xl mx-auto relative flex items-end gap-1.5 sm:gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputTextRef.current);
              }}
            >
              <div className={`relative flex-1 min-w-0 overflow-hidden bg-slate-50 border border-slate-300 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all flex flex-col dark:bg-[#151d30] dark:border-slate-600 ${isTyping ? 'animate-pulse opacity-80 border-blue-300' : ''} ${isListening ? 'border-red-400 ring-2 ring-red-200' : ''}`}>
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
                      {language === 'hi' ? 'रोकें (Done)' : 'Done'}
                    </button>
                  </div>
                )}
                <textarea 
                  ref={inputRef}
                  aria-label="Message input"
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
                  className={`w-full bg-transparent py-2.5 pl-3 pr-11 sm:p-4 sm:pr-14 focus:outline-none resize-none max-h-24 sm:max-h-32 min-h-[44px] sm:min-h-[56px] text-base leading-snug text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${language === 'hi' ? 'font-sans' : ''}`}
                  rows={1}
                  dir="auto"
                />
                <button 
                  type="button"
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  onClick={toggleListening}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={isWaitingForMic}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-11 sm:w-11 sm:right-2 sm:bottom-2 sm:top-auto sm:translate-y-0 p-0 rounded-lg sm:rounded-xl shadow-sm border flex items-center justify-center transition-all duration-200 overflow-hidden ${
                    isListening ? 'bg-red-600 text-white border-red-700 sm:ring-4 sm:ring-red-200 shadow-md' : 
                    isWaitingForMic ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                    'bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 border-slate-200 active:scale-95 dark:bg-[#1c2640] dark:text-slate-300 dark:border-slate-600 dark:hover:text-blue-300 dark:hover:border-blue-400'
                  }`}
                  title={isListening ? "Listening... click to stop" : (language === 'hi' ? "बोलकर लिखें (Speak)" : "Speak to type")}
                >
                  {isListening ? (
                    <div className="flex items-center justify-center gap-[2.5px] w-5 h-5">
                      <span className="w-[3px] bg-white h-2 animate-[bounce_1s_infinite_0ms] rounded-full"></span>
                      <span className="w-[3px] bg-white h-4.5 animate-[bounce_1s_infinite_200ms] rounded-full"></span>
                      <span className="w-[3px] bg-white h-3 animate-[bounce_1s_infinite_400ms] rounded-full"></span>
                      <span className="w-[3px] bg-white h-5 animate-[bounce_1s_infinite_600ms] rounded-full"></span>
                      <span className="w-[3px] bg-white h-2.5 animate-[bounce_1s_infinite_800ms] rounded-full"></span>
                    </div>
                  ) : (
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
              <button 
                type="submit"
                aria-label="Send message"
                disabled={!inputText.trim()}
              className={`p-2 sm:p-3.5 rounded-xl shrink-0 transition-colors mb-0 ${inputText.trim() ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'}`}
              >
                <Send className={`w-5 h-5 ${inputText.trim() ? 'text-white' : 'text-slate-400'}`} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub Components ---

const WelcomeState = ({ language }: { language: AppLang }) => (
  <div className="max-w-4xl mx-auto w-full min-w-0 flex flex-col items-center justify-center py-5 sm:py-8 animate-in fade-in zoom-in-95 duration-500 px-1">
    <div className="mb-3 flex h-16 w-16 items-center justify-center sm:mb-6 sm:h-20 sm:w-20">
      <ManakMark className="h-16 w-16 rounded-full shadow-md sm:h-20 sm:w-20" />
    </div>
    <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-50 mb-1.5 sm:mb-3 text-center tracking-tight">
      {UI_DICTIONARY[language].welcomeTitle}
    </h1>
    <p className="text-xs sm:text-lg text-slate-600 dark:text-slate-300 mb-5 sm:mb-8 text-center max-w-2xl px-2">
      {UI_DICTIONARY[language].welcomeDesc}
    </p>
    
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-12 text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300">
      <span className="flex items-center bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
        <FileText className="w-4 h-4 mr-1.5"/> Source-backed Answers
      </span>
    </div>
  </div>
);

const MessageBubble = ({ msg, language, onRetry }: { msg: Message, language: AppLang, onRetry?: () => void }) => {
  const isAI = msg.role === 'ai';
  // If historical or non-streaming/non-animated, start at full length so it renders immediately without replay
  const [displayedLength, setDisplayedLength] = useState<number>(() => {
    return isAI && (msg.isStreaming || msg.animate) ? 0 : msg.text.length;
  });
  const [copied, setCopied] = useState(false);

  const isActivelyTyping = isAI && (msg.isStreaming || msg.animate) && !msg.isError;
  const isFinishedTyping = !msg.isStreaming && displayedLength >= msg.text.length;

  // Fluid, natural typing animation loop
  useEffect(() => {
    if (!isAI || msg.isError || (!msg.isStreaming && !msg.animate)) {
      return;
    }

    if (displayedLength >= msg.text.length && !msg.isStreaming) {
      return;
    }

    let animationFrameId: number;
    let lastTick = performance.now();

    const loop = (now: number) => {
      const targetLen = msg.text.length;
      const diff = targetLen - displayedLength;

      if (diff > 0) {
        // Natural adaptive cadence:
        // - Small difference (1-10 chars): smooth single character typing (~20ms per char)
        // - Medium difference (11-35 chars): 1-2 chars per tick (~16ms)
        // - Large difference (>35 chars): accelerate smoothly to prevent backlog
        const interval = diff > 40 ? 12 : diff > 15 ? 16 : 20;

        if (now - lastTick >= interval) {
          lastTick = now;
          let step = 1;
          if (diff > 80) {
            step = Math.min(diff, Math.ceil(diff / 6));
          } else if (diff > 40) {
            step = 3;
          } else if (diff > 15) {
            step = 2;
          }

          setDisplayedLength(prev => Math.min(targetLen, prev + step));
        }
      }

      if (displayedLength < msg.text.length || msg.isStreaming) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAI, msg.isError, msg.isStreaming, msg.animate, msg.text.length, displayedLength]);

  // Safety completion fallback when streaming ends
  useEffect(() => {
    if (!msg.isStreaming && displayedLength < msg.text.length) {
      const timer = setTimeout(() => {
        setDisplayedLength(msg.text.length);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [msg.isStreaming, msg.text.length, displayedLength]);

  const displayedText = isActivelyTyping ? msg.text.slice(0, displayedLength) : msg.text;

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
    <div className={`flex gap-2 sm:gap-4 min-w-0 w-full ${!isAI ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
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
            ? 'bg-blue-900 text-white rounded-tr-sm border border-blue-800' 
            : msg.isError
            ? 'bg-red-50 text-red-800 rounded-tl-sm border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
            : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-200 pr-10 dark:bg-[#151d30] dark:text-slate-100 dark:border-slate-700'
        }`}>
          {isAI && !msg.isError && (
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-all focus:opacity-100 dark:hover:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Copy to clipboard"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          {/* Main Text */}
          {!displayedText && isAI && !msg.isError ? (
            <div className="flex items-center gap-2 py-1 text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {language === 'hi' ? 'मानक-मित्र उत्तर तैयार कर रहा है...' : 'ManakMitra is writing response...'}
              </span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-snug sm:leading-relaxed text-[13px] sm:text-[15px] mm-break">
              {renderInline(displayedText, msg.sources, isAI)}
              {/* Natural glowing typing cursor while streaming */}
              {isActivelyTyping && (!isFinishedTyping || displayedLength < msg.text.length) && displayedText.length > 0 && (
                <span 
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
              }`} title="Based on official BIS metadata evaluation">
                {msg.confidence === 'high' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'medium' && <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'low' && <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                {msg.confidence === 'high' ? UI_DICTIONARY[language].highConf :
                 msg.confidence === 'medium' ? UI_DICTIONARY[language].medConf :
                 UI_DICTIONARY[language].lowConf}
              </span>
            </div>
          )}
          
          {msg.isError && onRetry && (
            <div className="mt-4 flex">
              <button 
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {msg.processSteps && msg.processSteps.length > 0 && (
            <ol className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 w-full min-w-0 space-y-2">
              {msg.processSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-700 dark:bg-blue-950/70 dark:border-blue-400 dark:text-blue-200">{idx + 1}</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug mm-break">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Source Citations */}
          {msg.sources && msg.sources.filter((s) => isOfficialUrl(s.link) && !/google\.com\/search/i.test(s.link)).length > 0 && (
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
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 mx-1 font-medium">{msg.timestamp}</span>
      </div>
    </div>
  );
};

