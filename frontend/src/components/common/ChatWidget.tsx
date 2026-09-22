import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import aiService from '../../services/aiService';
import { useAuth } from '../../contexts';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

interface ChatAction {
  label: string;
  path: string;
}

const CHAT_SESSION_STORAGE_KEY = 'chatWidgetSessionId';

const createSessionId = () => {
  const existing = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `chat_${Date.now()}`;
  localStorage.setItem(CHAT_SESSION_STORAGE_KEY, generated);
  return generated;
};

export function ChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Show available courts',
    'Explain booking steps',
    'How does 50% deposit work?',
  ]);
  const [actions, setActions] = useState<ChatAction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I can help with courts, booking steps, deposit/payment questions, and account help.',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const sessionId = useMemo(() => createSessionId(), []);

  useEffect(() => {
    if (isOpen && shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isAuthenticated || location.pathname === '/login') {
    return null;
  }

  const sendMessage = async (rawMessage?: string) => {
    const text = (rawMessage ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    };

    const viewport = messagesViewportRef.current;
    if (viewport) {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < 40;
    } else {
      shouldAutoScrollRef.current = true;
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await aiService.chat({
        message: text,
        sessionId,
        context: {
          page: location.pathname,
          role: (user?.currentRole || user?.profileType || 'customer') as 'customer' | 'business' | 'both',
        },
      });

      const reply = response?.data?.reply?.trim();
      const assistantMessage: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: reply || 'I could not generate a response right now. Please try again.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (Array.isArray(response?.data?.suggestions) && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions.slice(0, 3));
      }
      if (Array.isArray(response?.data?.actions) && response.data.actions.length > 0) {
        const clean = response.data.actions
          .filter((a) => a && typeof a.path === 'string' && typeof a.label === 'string')
          .slice(0, 3);
        setActions(clean);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unable to reach chatbot service.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: 'assistant',
          content: 'Chat is temporarily unavailable. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-3 bottom-3 sm:right-4 sm:bottom-4" style={{ zIndex: 9999 }}>
      {isOpen && (
        <Card
          className="mb-3 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          style={{ width: '320px', maxWidth: 'calc(100vw - 12px)', height: '460px' }}
        >
          <div className="flex items-center justify-between bg-[#010101] px-4 py-3 text-white">
            <p className="text-sm font-semibold">Customer Support</p>
            <MessageCircle className="h-4 w-4 text-[#98e209]" />
          </div>

          {/*
            FIX 1: Added style overrides to CardContent.
            shadcn's CardContent has no min-h-0, which breaks flex height
            containment — the scroll div grows unbounded instead of scrolling.
            Force display:flex + min-height:0 + overflow:hidden here.
          */}
          <CardContent
            className="flex min-h-0 flex-1 flex-col p-2"
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
          >
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 rounded-full text-xs"
                  onClick={() => sendMessage(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {actions.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {actions.map((action) => (
                  <Button
                    key={`${action.label}-${action.path}`}
                    variant="secondary"
                    size="sm"
                    className="h-7 shrink-0 rounded-full text-xs"
                    onClick={() => {
                      navigate(action.path);
                      setIsOpen(false);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/*
              FIX 2: Removed scrollbarGutter:'stable' — it was reserving space
              for the scrollbar even when no scrolling was needed, causing layout
              shifts and conflicting with the flex height chain.

              FIX 3: Added explicit inline styles for the scrollbar so it works
              regardless of CSS class load order or Tailwind purging chat-scroll.
              overflow-y: scroll  → always shows the scrollbar track (reliable)
              scrollbar-width     → Firefox thin scrollbar
              The ::-webkit- rules live in index.css via .chat-scroll class.
            */}
            <div
              ref={messagesViewportRef}
              className="chat-scroll min-h-0 flex-1 space-y-2 rounded-lg bg-gray-50 p-2 overscroll-contain"
              style={{
                overflowY: 'scroll',
                minHeight: 0,
                flex: '1 1 0',
                scrollbarWidth: 'thin',
                scrollbarColor: '#d1d5db transparent',
              }}
              onWheel={(e) => {
                if (e.deltaY < 0) {
                  shouldAutoScrollRef.current = false;
                }
              }}
              onScroll={() => {
                const viewport = messagesViewportRef.current;
                if (!viewport) return;
                const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
                shouldAutoScrollRef.current = distanceFromBottom < 40;
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-5 ${
                    msg.role === 'user'
                      ? 'ml-auto bg-[#98e209] text-[#010101]'
                      : 'mr-auto bg-white text-[#111827]'
                  }`}
                >
                  <span className="block whitespace-pre-wrap wrap-break-word">{msg.content}</span>
                </div>
              ))}
              {isLoading && (
                <div className="mr-auto flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-[#010101]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && <p className="mt-2 px-1 text-xs text-red-600">{error}</p>}

            <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about courts, booking, or payment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="bg-[#010101] text-white hover:bg-[#222]"
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        size="icon"
        className="h-16 w-16 rounded-full bg-[#010101] text-white shadow-lg hover:bg-[#222]"
        aria-label={isOpen ? 'Close support chatbot' : 'Open support chatbot'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
}