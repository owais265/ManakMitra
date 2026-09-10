'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { 
  FileText, Award, 
  HelpCircle, ShieldCheck, 
  Send, Mic, CheckCircle, 
  AlertTriangle, XCircle, ExternalLink, 
  ChevronRight, Menu, X, Info, Loader2, ArrowRight, Copy, Check, Share, RotateCcw, WifiOff
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { APP_LANGS, speechLang, UI_DICTIONARY, type AppLang } from '@/lib/language';

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
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMode, setContextMode] = useState<string>('general');
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForMic, setIsWaitingForMic] = useState(false);
  const [language, setLanguage] = useState<AppLang>('en');
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullMoveY, setPullMoveY] = useState<number>(0);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const isRestoredRef = useRef(false);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechBaseTextRef = useRef<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputTextRef = useRef('');
  inputTextRef.current = inputText;

  const startNewSession = () => {
    const newSessionId = createUniqueId();
    setSessionId(newSessionId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('chat_session_id', newSessionId);
      sessionStorage.setItem('chat_history', JSON.stringify([]));
      sessionStorage.setItem('chat_context_mode', 'general');
    }
    setMessages([]);
    setContextMode('general');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = scrollContainerRef.current;
    if (el && el.scrollTop <= 0) {
      setPullStartY(e.touches[0].clientY);
    } else {
      setPullStartY(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY === null) return;
    const el = scrollContainerRef.current;
    if (el && el.scrollTop > 0) {
      setPullStartY(null);
      setIsPulling(false);
      setPullMoveY(0);
      return;
    }
    const distance = e.touches[0].clientY - pullStartY;
    if (distance > 20) {
      setPullMoveY(distance);
      setIsPulling(true);
    } else if (distance <= 0) {
      setIsPulling(false);
      setPullMoveY(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullMoveY > 100) {
      startNewSession();
    }
    setPullStartY(null);
    setPullMoveY(0);
    setIsPulling(false);
  };

  // Restore state after mount to ensure initial SSR render matches client hydration perfectly
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = sessionStorage.getItem('chat_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
        let currentSessionId = sessionStorage.getItem('chat_session_id');
        if (!currentSessionId) {
          currentSessionId = createUniqueId();
          sessionStorage.setItem('chat_session_id', currentSessionId);
        }
        setSessionId(currentSessionId);

        const storedContextMode = sessionStorage.getItem('chat_context_mode');
        if (storedContextMode) {
          setContextMode(storedContextMode);
        }
      } catch (e) {
        console.error("Failed to restore chat session", e);
      } finally {
        isRestoredRef.current = true;
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save to session storage only after restoration is complete
  useEffect(() => {
    if (isRestoredRef.current && typeof window !== 'undefined') {
      sessionStorage.setItem('chat_history', JSON.stringify(messages));
      sessionStorage.setItem('chat_context_mode', contextMode);
    }
  }, [messages, contextMode]);

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

  // Sync sidebar open state with isMobile initially
  useEffect(() => {
    // Only run on client after hydration to avoid hydration mismatch
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        setSidebarOpen(!isMobile);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
          history: messages
            .filter((m) => m.text?.trim())
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text.slice(0, 500) })),
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
                if (line.startsWith('[SOURCE]')) {
                  const parts = line.replace('[SOURCE]', '').split('|').map(s => s.trim());
                  if (parts.length >= 4) {
                    sources.push({ id: createUniqueId(), title: parts[0], type: parts[1], date: parts[2], link: parts[3] });
                  }
                } else if (line.startsWith('[FOLLOW_UP]')) {
                  followUps.push(line.replace('[FOLLOW_UP]', '').trim());
                } else if (line.startsWith('[META]')) {
                  const parts = line.replace('[META]', '').split('|').map(s => s.trim());
                  if (parts[0]) msg.confidence = parts[0] as Confidence;
                  if (parts[1]) setContextMode(parts[1]);
                } else if (line.startsWith('[PROCESS_STEPS]')) {
                  processSteps = line.replace('[PROCESS_STEPS]', '').split('|').map(s => s.trim()).filter(Boolean);
                } else {
                  pureText += line + '\n';
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
      className="relative flex flex-col bg-white text-slate-800 font-sans overflow-hidden min-w-0 min-h-0 z-0"
      style={{
        position: "fixed",
        top: "var(--mm-vvt, 0px)",
        left: "var(--mm-vvl, 0px)",
        width: "var(--mm-vvw, 100%)",
        height: "var(--mm-vvh, 100dvh)",
      }}
    >
      {/* Header (Fixed Top) */}
      <header className="h-12 sm:h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-6 shrink-0 min-w-0">
        <div className="flex items-center min-w-0">
          <button aria-label="Toggle sidebar" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-1 sm:mr-3 p-1.5 sm:p-2 -ml-0.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg shrink-0">
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <ShieldCheck className="h-5 w-5 sm:h-8 sm:w-8 text-blue-800 mr-1.5 sm:mr-2 shrink-0" />
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 leading-tight truncate">ManakMitra <span className="text-blue-700 hidden sm:inline">- AI Assistant</span></h1>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-slate-500 font-medium tracking-wide truncate">BUREAU OF INDIAN STANDARDS</p>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-2 md:space-x-4 shrink-0">
          <label className="sr-only" htmlFor="mm-lang">Language</label>
          <select
            id="mm-lang"
            aria-label="Reply language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppLang)}
            className="px-1 sm:px-2 py-0.5 sm:py-1 text-[16px] sm:text-sm font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 transition-colors max-w-[6.5rem] sm:max-w-[9.5rem] sm:mr-2"
          >
            {APP_LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.native}</option>
            ))}
          </select>
          
          <button 
            aria-label={UI_DICTIONARY[language].shareConversation}
            onClick={shareConversation}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
            title={UI_DICTIONARY[language].shareConversation}
          >
            <Share className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 sm:top-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:w-auto sm:max-w-md sm:transform sm:-translate-x-1/2 z-[60] bg-slate-800 text-white px-3 py-2 rounded-full shadow-lg text-xs sm:text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 max-w-[calc(100%-1.5rem)] mx-auto">
          <Info className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden w-full min-w-0 relative">
        {/* Sidebar */}
        <div className={`sidebar-container
          fixed inset-y-0 left-0 z-40 bg-slate-50 border-r border-slate-200 shadow-2xl transition-transform duration-300 transform
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:shadow-none lg:transition-[width] lg:duration-300 lg:ease-in-out
          ${sidebarOpen ? 'lg:w-[320px]' : 'lg:w-0 lg:border-transparent'}
          flex flex-col shrink-0 overflow-hidden w-[min(18rem,85vw)]
        `}>
          <div className="w-full h-full flex flex-col p-0">
            {isMobile && (
              <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm text-slate-500 z-50">
                <X className="w-5 h-5" />
              </button>
            )}
            <SidebarContext contextMode={contextMode} language={language} />
          </div>
        </div>
        
        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-30" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 h-full bg-white relative min-w-0 max-w-full overflow-hidden">
          
          {/* Offline / Limited Connectivity Banner */}
          {!isOnline && (
            <div 
              role="status" 
              aria-live="polite"
              className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs sm:text-sm text-amber-900 flex items-center justify-between gap-3 shrink-0 z-30 animate-in fade-in slide-in-from-top-1 duration-200"
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-clip px-2.5 py-2.5 sm:p-6 lg:p-8 scroll-smooth relative overscroll-y-contain touch-pan-y"
          >
            {isPulling && (
              <div className="absolute top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform" style={{ transform: `translateY(${Math.min(pullMoveY / 2, 50)}px)` }}>
                <div className="bg-white shadow-md rounded-full p-2 text-slate-500 border border-slate-200">
                  {pullMoveY > 100 ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <ArrowRight className="w-5 h-5 transform rotate-90 transition-transform" style={{ transform: `rotate(90deg) scale(${Math.min(pullMoveY / 100, 1)})` }} />}
                </div>
              </div>
            )}
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
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 bg-slate-200 rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0 max-w-2xl bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
                        <div className="h-4 bg-slate-100 rounded w-1/4 animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-100 rounded w-full animate-pulse"></div>
                          <div className="h-3 bg-slate-100 rounded w-full animate-pulse"></div>
                          <div className="h-3 bg-slate-100 rounded w-5/6 animate-pulse"></div>
                        </div>
                        <div className="h-6 bg-slate-100 rounded w-32 animate-pulse mt-4"></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
          </div>
          
          {/* Input Area (Fixed Bottom) */}
          <div className="w-full min-w-0 px-2.5 pt-2 sm:p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <form
              className="max-w-4xl mx-auto relative flex items-end gap-1.5 sm:gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputTextRef.current);
              }}
            >
              <div className={`relative flex-1 min-w-0 overflow-hidden bg-slate-50 border border-slate-300 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all flex flex-col ${isTyping ? 'animate-pulse opacity-80 border-blue-300' : ''} ${isListening ? 'border-red-400 ring-2 ring-red-200' : ''}`}>
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
                  placeholder={isListening ? (language === 'hi' ? 'बोलिए... आपकी आवाज़ टेक्स्ट में बदल रही है' : 'Listening... your words will appear here') : (language === 'hi' ? 'मानक-मित्र से बात करें...' : 'Talk with ManakMitra')}
                  className={`w-full bg-transparent py-2.5 pl-3 pr-11 sm:p-4 sm:pr-14 focus:outline-none resize-none max-h-24 sm:max-h-32 min-h-[44px] sm:min-h-[56px] text-base leading-snug text-slate-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${language === 'hi' ? 'font-sans' : ''}`}
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
                    isWaitingForMic ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' :
                    'bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 border-slate-200 active:scale-95'
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
              className={`p-2 sm:p-3.5 rounded-xl shrink-0 transition-colors mb-0 ${inputText.trim() ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                <Send className={`w-5 h-5 ${inputText.trim() ? 'text-white' : 'text-slate-400'}`} />
              </button>
            </form>
            
            <p className="text-center text-[9px] sm:text-[10px] text-slate-400 mt-1.5 sm:mt-3 font-medium px-1 leading-snug mm-break">
              {UI_DICTIONARY[language].disclaimer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub Components ---

const WelcomeState = ({ language }: { language: AppLang }) => (
  <div className="max-w-4xl mx-auto w-full min-w-0 flex flex-col items-center justify-center py-5 sm:py-8 animate-in fade-in zoom-in-95 duration-500 px-1">
    <div className="w-12 h-12 sm:w-20 sm:h-20 bg-blue-900 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-6 shadow-lg border-4 border-blue-100">
      <ShieldCheck className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
    </div>
    <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mb-1.5 sm:mb-3 text-center tracking-tight">
      {UI_DICTIONARY[language].welcomeTitle}
    </h1>
    <p className="text-xs sm:text-lg text-slate-600 mb-5 sm:mb-8 text-center max-w-2xl px-2">
      {UI_DICTIONARY[language].welcomeDesc}
    </p>
    
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-12 text-[10px] sm:text-xs font-semibold text-slate-600">
      <span className="flex items-center bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
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

  // Auto-scroll follow during active typing if user is already near bottom
  useEffect(() => {
    if (isActivelyTyping && !isFinishedTyping) {
      const container = document.getElementById('chat-scroll-container');
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  }, [displayedLength, isActivelyTyping, isFinishedTyping]);

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
        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5 sm:mt-1 ${msg.isError ? 'bg-red-100 border-red-200' : 'bg-blue-100 border-blue-200'}`}>
          {msg.isError ? <X className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-700" /> : <ShieldCheck className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-700" />}
        </div>
      )}
      
      <div className={`min-w-0 max-w-[92%] sm:max-w-[90%] md:max-w-[85%] flex flex-col ${!isAI ? 'items-end' : 'items-start'}`}>
        <div className={`p-3 sm:p-5 rounded-2xl shadow-sm relative group min-w-0 max-w-full overflow-hidden ${
          !isAI 
            ? 'bg-blue-900 text-white rounded-tr-sm border border-blue-800' 
            : msg.isError
            ? 'bg-red-50 text-red-800 rounded-tl-sm border border-red-200'
            : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-200 pr-10'
        }`}>
          {isAI && !msg.isError && (
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-all focus:opacity-100"
              aria-label="Copy to clipboard"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          {/* Main Text */}
          {!displayedText && isAI && !msg.isError ? (
            <div className="flex items-center gap-2 py-1 text-slate-500">
              <span className="text-xs font-medium text-slate-500">
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
              {/* Parse markdown bold and IS Codes */}
              {displayedText.split('**').map((part, i) => {
                const isBold = i % 2 === 1;
                const isCodeRegex = /(\bIS\s+\d+(?:[:\-]\s*\d{2,4})?(?:\s*\(?Part\s*\d+\)?)?\b)/gi;
                const subParts = part.split(isCodeRegex);
                
                const renderedSubParts = subParts.map((subPart, j) => {
                  if (j % 2 === 1) {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(subPart.trim() + ' Indian Standard')}`;
                    return (
                      <a 
                        key={j} 
                        href={searchUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 underline decoration-orange-300 font-semibold transition-colors mx-0.5"
                        title="Search this Indian Standard"
                      >
                        {subPart}
                      </a>
                    );
                  }
                  return subPart;
                });

                if (isBold) {
                  return <strong key={i} className={!isAI ? 'text-white' : 'text-slate-900 font-bold'}>{renderedSubParts}</strong>;
                }
                return <React.Fragment key={i}>{renderedSubParts}</React.Fragment>;
              })}
              {/* Natural glowing typing cursor while streaming */}
              {isActivelyTyping && (!isFinishedTyping || displayedLength < msg.text.length) && displayedText.length > 0 && (
                <span 
                  className="inline-block w-2 h-4 ml-1 -mb-0.5 align-middle bg-blue-600 rounded-[1px] animate-pulse" 
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
                msg.confidence === 'high' ? 'bg-green-100 text-green-800 border-green-200' :
                msg.confidence === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-red-100 text-red-800 border-red-200'
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
            <div className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200 w-full min-w-0">
              <div className="flex flex-wrap gap-1.5 sm:hidden">
                {msg.processSteps.map((step, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1 max-w-full rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 border border-blue-600 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-700">{idx + 1}</span>
                    <span className="text-[10px] font-medium text-slate-600 leading-tight mm-break">{step}</span>
                  </div>
                ))}
              </div>
              <div className="hidden sm:flex items-center min-w-0 overflow-x-auto pb-8">
                {msg.processSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center relative">
                      <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center z-10">
                        <span className="text-xs font-bold text-blue-700">{idx + 1}</span>
                      </div>
                      <span className="absolute top-10 w-24 text-center text-[10px] font-medium text-slate-600 leading-tight">
                        {step}
                      </span>
                    </div>
                    {idx < msg.processSteps!.length - 1 && (
                      <div className="h-0.5 w-16 bg-blue-200 relative -top-0">
                        <div className="absolute top-0 left-0 h-full bg-blue-500 w-full"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Questions */}
          {msg.followUpQuestions && (
            <div className="mt-4 sm:mt-5 bg-orange-50 border border-orange-200 rounded-xl p-3 sm:p-4 min-w-0">
              <p className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> 
                {UI_DICTIONARY[language].followUp}
              </p>
              <ul className="space-y-2">
                {msg.followUpQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-orange-800 text-sm font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5"></span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source Citations */}
          {msg.sources && msg.sources.length > 0 && (
            <div className="mt-4 sm:mt-5 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm min-w-0">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {UI_DICTIONARY[language].sources} ({msg.sources.length} {UI_DICTIONARY[language].documents})
              </h4>
              <ul className="space-y-3">
                {msg.sources.map(s => (
                  <li key={s.id} className="group">
                    <a href={s.link} className="text-blue-700 font-semibold text-sm hover:underline flex items-start gap-1.5 min-w-0">
                      <span className="mt-0.5 mm-break">{s.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{s.type}</span>
                      <span className="text-xs text-slate-500 font-medium">{s.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-400 mt-1.5 mx-1 font-medium">{msg.timestamp}</span>
      </div>
    </div>
  );
};

const SidebarContext = ({ contextMode, language }: { contextMode: string, language: AppLang }) => {
  const [huid, setHuid] = useState('');
  return (
    <div className="h-full flex flex-col bg-slate-50 sidebar-container">
      <div className="p-5 border-b border-slate-200 bg-white shrink-0">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          {UI_DICTIONARY[language].contextHelper}
        </h3>
      </div>
      
      <div className="p-0 overflow-y-auto flex-1">
        <div>
            <SidebarSection title={UI_DICTIONARY[language].quickLinks} icon={<ExternalLink className="w-4 h-4 text-slate-500"/>} items={[
              { label: 'All Certification Schemes (ISI, CRS)', url: 'https://www.bis.gov.in/index.php/product-certification/' },
              { label: 'Search QCO Notifications', url: 'https://www.bis.gov.in/index.php/quality-control-orders/' },
              { label: 'Accredited Testing Labs Directory', url: 'https://www.bis.gov.in/index.php/laboratory/' }
            ]} />
        </div>

        {contextMode === 'hallmarking' && (
          <div>
             <SidebarSection title={UI_DICTIONARY[language].understandingPurity} icon={<Award className="w-4 h-4 text-amber-500"/>} items={[
              '24K995 (99.5% Gold)', 
              '22K916 (91.6% Gold)', 
              '18K750 (75.0% Gold)',
              '14K585 (58.5% Gold)'
            ]} />
             <div className="bg-amber-50 border-y border-amber-200 p-5 mt-4">
               <h4 className="font-bold text-amber-900 mb-2 text-sm">{UI_DICTIONARY[language].huidLookup}</h4>
               <input type="text" value={huid} onChange={(e) => setHuid(e.target.value)} maxLength={6} placeholder={UI_DICTIONARY[language].enterHuid} className="w-full text-sm p-2 rounded-lg border border-amber-300 mb-2 uppercase font-mono" />
               <button type="button" onClick={() => window.open('https://www.bis.gov.in/bis-apps/?lang=en', '_blank', 'noopener,noreferrer')} className="w-full bg-amber-600 text-white text-sm font-bold py-2 rounded-lg">{UI_DICTIONARY[language].verifyJeweller}</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SidebarSection = ({ title, items, icon, numbered = false }: { title: string, items: (string | {label: string, url: string})[], icon?: React.ReactNode, numbered?: boolean }) => (
  <div className="p-5 space-y-3 border-b border-slate-100 last:border-0 bg-white">
    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
      {icon} {title}
    </h4>
    <ul className="space-y-2">
      {items.map((item, i) => {
        const isLink = typeof item === 'object' && item !== null && 'url' in item;
        const label = isLink ? item.label : item as string;
        const url = isLink ? item.url : undefined;
        
        return (
          <li key={i} className="text-sm font-medium text-slate-700 flex items-start gap-2 leading-snug">
            {!numbered && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1 w-full">
                {label}
              </a>
            ) : (
              <span>{label}</span>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);
