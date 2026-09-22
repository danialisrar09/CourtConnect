import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageCircleMore, Send, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useChat } from '../../contexts/ChatContext';

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CC';

export function ChatDrawer() {
  const {
    activeConversation,
    drawerOpen,
    startingConversation,
    startingConversationError,
    closeDrawer,
    messages,
    messagesLoading,
    messagesError,
    setTyping,
    sendTextMessage,
    socketConnected,
    remoteTyping,
  } = useChat();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const typingStopRef = useRef<number | null>(null);

  const title = useMemo(() => {
    if (!activeConversation) return 'Chat';
    return `Chat with ${activeConversation.otherParticipant.name}`;
  }, [activeConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, remoteTyping]);

  useEffect(() => {
    if (!activeConversation) return;

    const shouldType = draft.trim().length > 0;
    setTyping(shouldType);

    if (typingStopRef.current) {
      window.clearTimeout(typingStopRef.current);
    }

    if (shouldType) {
      typingStopRef.current = window.setTimeout(() => setTyping(false), 900);
    }

    return () => {
      if (typingStopRef.current) {
        window.clearTimeout(typingStopRef.current);
      }
    };
  }, [activeConversation, draft, setTyping]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer, drawerOpen]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    try {
      setSending(true);
      await sendTextMessage(draft);
      setTyping(false);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  if (!drawerOpen) return null;

  const drawerMarkup = (
    <>
      <div
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: 10000 }}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ zIndex: 10001 }}
        className="fixed inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl sm:max-w-xl"
      >
        <button
          type="button"
          onClick={closeDrawer}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-[#010101]"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-gray-200 px-6 py-5" style={{ flexShrink: 0 }}>
          <div className="pr-8">
            <h2 className="text-xl font-semibold text-[#010101]">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {activeConversation?.venueName ? `${activeConversation.venueName} · ` : ''}
              {socketConnected ? 'Realtime connected' : 'Connecting to chat...'}
            </p>
          </div>
        </div>

        {!activeConversation ? (
          /* Loading / empty state — takes all remaining height */
          <div
            className="flex flex-col items-center justify-center gap-3 px-6 text-center text-gray-500"
            style={{ flex: '1 1 0', minHeight: 0 }}
          >
            {startingConversation ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-[#98e209]" />
                <p className="text-lg font-semibold text-[#010101]">Opening chat...</p>
                <p className="max-w-sm text-sm">Setting up your conversation with the venue owner.</p>
              </>
            ) : startingConversationError ? (
              <div className="w-full max-w-md rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
                <p className="text-base font-semibold text-red-700">Unable to open chat</p>
                <p className="mt-2 text-sm text-red-600">{startingConversationError}</p>
                <p className="mt-3 text-xs text-red-500">Please try again in a moment.</p>
              </div>
            ) : (
              <>
                <MessageCircleMore className="h-12 w-12 text-[#98e209]" />
                <p className="text-lg font-semibold text-[#010101]">Choose a conversation to begin</p>
                <p className="max-w-sm text-sm">
                  Open chat from a venue page or from the Messages tab in your dashboard.
                </p>
              </>
            )}
          </div>
        ) : (
          /*
            Single wrapper div for messages + input footer.
            This is the key fix: messages and input MUST be inside one flex
            child that owns the remaining height. If they are separate flex
            children of SheetContent, the messages div has no bounded height
            to scroll within — it grows infinitely instead of scrolling.
          */
          <div
            className="flex flex-col bg-white"
            style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}
          >
            {/* Scrollable messages area — grows to fill space, then scrolls */}
            <div
              className="space-y-4 bg-[#f8fbea] px-5 py-5"
              style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}
            >
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading messages...
                </div>
              ) : messagesError ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
                  <p className="text-base font-semibold text-red-700">Unable to load messages</p>
                  <p className="mt-2 text-sm text-red-600">{messagesError}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#98e209] bg-white/80 px-6 py-8 text-center shadow-sm">
                  <p className="text-base font-semibold text-[#010101]">No messages yet</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Start the conversation with the venue owner here.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId !== activeConversation.otherParticipant.userId;

                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!isMine && (
                          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                            <Avatar className="h-6 w-6 border border-[#d9ef9d]">
                              <AvatarImage src={activeConversation.otherParticipant.avatar || undefined} />
                              <AvatarFallback className="bg-[#98e209] text-[#010101] text-[10px]">
                                {initials(activeConversation.otherParticipant.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{activeConversation.otherParticipant.name}</span>
                          </div>
                        )}

                        <div
                          className={
                            isMine
                              ? 'rounded-[24px] rounded-br-md bg-[#010101] px-4 py-3 text-white shadow-md'
                              : 'rounded-[24px] rounded-bl-md bg-white px-4 py-3 text-[#010101] shadow-md border border-[#e7efcc]'
                          }
                        >
                          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6">
                            {message.content}
                          </p>
                        </div>

                        <div
                          className={`flex items-center gap-2 px-1 text-[11px] ${
                            isMine ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {isMine && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-[#d9ef9d] bg-white/80 text-[10px] uppercase tracking-wide text-gray-600"
                            >
                              {message.myStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {remoteTyping && (
                <div className="inline-flex rounded-full border border-[#d9ef9d] bg-white px-4 py-2 text-sm text-gray-500 shadow-sm">
                  {activeConversation.otherParticipant.name} is typing...
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input footer — never shrinks */}
            <div
              className="border-t border-gray-200 bg-white px-5 py-4"
              style={{ flexShrink: 0 }}
            >
              <div className="rounded-[28px] border border-[#d9ef9d] bg-[#fbfef2] p-3 shadow-sm">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type your message..."
                  className="min-h-[88px] border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0"
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    Messages send instantly when the other user is online.
                  </p>
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="rounded-full bg-[#98e209] px-6 h-10 text-[#010101] hover:bg-[#89cb08] font-medium"
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );

  if (typeof document === 'undefined') {
    return drawerMarkup;
  }

  return createPortal(drawerMarkup, document.body);
}