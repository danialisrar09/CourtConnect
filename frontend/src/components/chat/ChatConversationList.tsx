import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircleMore, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useChat } from '../../contexts/ChatContext';

interface ChatConversationListProps {
  role: 'customer' | 'business';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CC';

const formatTimestamp = (value: string | null) => {
  if (!value) return 'No messages yet';

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString();
};

export function ChatConversationList({ role }: ChatConversationListProps) {
  const {
    conversations,
    conversationsLoading,
    conversationsError,
    activeConversation,
    messages,
    messagesLoading,
    messagesError,
    loadConversations,
    openConversation,
    sendTextMessage,
    closeDrawer,
  } = useChat();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadConversations(role === 'business' ? search.trim() : undefined).catch(() => undefined);
    }, role === 'business' ? 250 : 0);

    return () => window.clearTimeout(timer);
  }, [loadConversations, role, search]);

  // Auto-scroll messages to bottom only when user is already near the bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // On conversation change: reset auto-scroll and scroll active item into view in list
  useEffect(() => {
    setDraft('');
    shouldAutoScrollRef.current = true;
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeConversation?.id]);

  const title = useMemo(() => (role === 'business' ? 'Customer Messages' : 'Messages'), [role]);

  const handleSend = async () => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || sending || !activeConversation) {
      return;
    }

    try {
      setSending(true);
      await sendTextMessage(trimmedDraft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>{title}</CardTitle>
          <Button variant="outline" onClick={() => loadConversations(role === 'business' ? search.trim() : undefined)}>
            Refresh
          </Button>
        </div>
        {role === 'business' && (
          <div className="relative mt-2 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers by name"
              className="rounded-full border-[#d9ef9d] pl-10"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {conversationsLoading ? (
          <div className="py-12 text-center text-gray-500">Loading conversations...</div>
        ) : conversationsError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-base font-semibold text-red-700">Unable to load conversations</p>
            <p className="mt-2 text-sm text-red-600">{conversationsError}</p>
            <Button className="mt-4" variant="outline" onClick={() => loadConversations(role === 'business' ? search.trim() : undefined)}>
              Try Again
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d9ef9d] px-6 py-12 text-center">
            <MessageCircleMore className="mx-auto h-10 w-10 text-[#98e209]" />
            <p className="mt-4 text-lg font-semibold text-[#010101]">No conversations yet</p>
            <p className="mt-2 text-sm text-gray-500">
              {role === 'business'
                ? 'Customer chats will appear here when people contact your venue.'
                : 'Open a venue page and tap Chat with Owner to start a conversation.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-[26rem] space-y-3 overflow-y-auto rounded-2xl border border-[#e6efd0] bg-white p-2 pr-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  ref={activeConversation?.id === conversation.id ? activeItemRef : null}
                  type="button"
                  onClick={() => {
                    if (activeConversation?.id === conversation.id) {
                      closeDrawer();
                      return;
                    }

                    openConversation(conversation, { openDrawer: false }).catch(() => undefined);
                  }}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${
                    activeConversation?.id === conversation.id
                      ? 'border-[#98e209] bg-[#f7fce7] shadow-md'
                      : 'border-gray-200 bg-white hover:border-[#cce97a] hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-11 w-11 border border-[#d9ef9d]">
                      <AvatarImage src={conversation.otherParticipant.avatar || undefined} />
                      <AvatarFallback className="bg-[#98e209] text-[#010101]">
                        {initials(conversation.otherParticipant.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#010101]">{conversation.otherParticipant.name}</p>
                          <p className="truncate text-sm text-gray-500">{conversation.venueName || 'Venue conversation'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-gray-400">{formatTimestamp(conversation.lastMessageAt)}</span>
                          {conversation.unreadCount > 0 && (
                            <Badge className="h-6 min-w-7 rounded-full bg-[#98e209] px-2 text-[11px] font-semibold text-[#010101] leading-none hover:bg-[#98e209]">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 truncate text-sm text-gray-600">
                        {conversation.lastMessageText || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activeConversation && (
              <div className="rounded-3xl border border-[#d9ef9d] bg-[#f8fbea] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[#d9ef9d] pb-3">
                  <div>
                    <p className="font-semibold text-[#010101]">{activeConversation.otherParticipant.name}</p>
                    <p className="text-sm text-gray-500">{activeConversation.venueName || 'Venue conversation'}</p>
                  </div>
                  <Badge className="rounded-full bg-[#98e209] text-[#010101] hover:bg-[#98e209]">
                    Open chat
                  </Badge>
                </div>

                <div
                  ref={messagesViewportRef}
                  className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-white p-3"
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
                  {messagesLoading ? (
                    <p className="py-6 text-center text-sm text-gray-500">Loading messages...</p>
                  ) : messagesError ? (
                    <p className="py-6 text-center text-sm text-red-600">{messagesError}</p>
                  ) : messages.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">No messages yet. Start the conversation below.</p>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.senderId !== activeConversation.otherParticipant.userId;

                      return (
                        <div key={message.id} className={isMine ? 'flex justify-end' : 'flex justify-start'}>
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                              isMine
                                ? 'bg-[#010101] text-white'
                                : 'border border-[#d9ef9d] bg-[#f8fbea] text-[#010101]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                            <p className={`mt-1 text-[11px] ${isMine ? 'text-gray-300' : 'text-gray-500'}`}>
                              {formatTimestamp(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <div className="mt-4 space-y-3">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[96px] rounded-2xl border-[#d9ef9d] bg-white"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend().catch(() => undefined);
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={!draft.trim() || sending}
                      className="rounded-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}