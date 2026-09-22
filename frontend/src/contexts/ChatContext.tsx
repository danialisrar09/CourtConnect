import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import chatService, { ChatConversation, ChatMessage } from '../services/chatService';
import { useChatSocket } from '../hooks/useChatSocket';

interface OpenConversationOptions {
  openDrawer?: boolean;
}

interface ChatContextValue {
  unreadTotal: number;
  conversations: ChatConversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  messagesError: string | null;
  activeConversation: ChatConversation | null;
  drawerOpen: boolean;
  startingConversation: boolean;
  startingConversationError: string | null;
  socketConnected: boolean;
  remoteTyping: boolean;
  loadConversations: (search?: string) => Promise<void>;
  openConversation: (conversation: ChatConversation, options?: OpenConversationOptions) => Promise<void>;
  startConversationForVenue: (venueId: string, options?: OpenConversationOptions) => Promise<void>;
  openChatPanel: () => void;
  closeDrawer: () => void;
  setTyping: (isTyping: boolean) => void;
  sendTextMessage: (content: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const sortConversations = (items: ChatConversation[]) => {
  return [...items].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
};

const dedupeMessages = (items: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>();
  items.forEach((message) => {
    map.set(message.id, message);
  });
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const userId = user?.id || '';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [startingConversation, setStartingConversation] = useState(false);
  const [startingConversationError, setStartingConversationError] = useState<string | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const typingTimeoutRef = useRef<number | null>(null);

  /**
   * KEY FIX — stale closure prevention.
   *
   * `useChatSocket` registers its callbacks once on mount. Any callback that
   * reads `activeConversation` directly from the outer scope captures the
   * *initial* value (null) and never sees updates — a classic stale closure.
   *
   * Solution: keep a ref that is always in sync with the state value, and
   * read from the ref inside socket callbacks instead of the state variable.
   */
  const activeConversationRef = useRef<ChatConversation | null>(null);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const upsertConversation = useCallback((conversation: ChatConversation) => {
    setConversations((current) => {
      const next = current.filter((item) => item.id !== conversation.id);
      next.unshift(conversation);
      return sortConversations(next);
    });
  }, []);

  const markConversationReadLocally = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
  }, []);

  const patchMessageStatus = useCallback(
    (messageIds: string[], status: 'delivered' | 'read', actorUserId: string) => {
      setMessages((current) =>
        current.map((message) => {
          if (!messageIds.includes(message.id)) return message;
          const uid = userIdRef.current;
          const isMyOutgoing = actorUserId !== uid && message.senderId === uid;
          const isMyIncoming = actorUserId === uid && message.senderId !== uid;
          if (!isMyOutgoing && !isMyIncoming) return message;
          return { ...message, myStatus: status };
        })
      );
    },
    []
  );

  const loadConversations = useCallback(
    async (search?: string) => {
      if (!isAuthenticated) {
        setConversations([]);
        return;
      }
      try {
        setConversationsLoading(true);
        setConversationsError(null);
        const response = await chatService.getConversations({
          limit: 50,
          search: search || undefined,
        });
        setConversations(sortConversations(response.conversations));
      } catch (error: any) {
        console.error('Failed to load conversations:', error);
        const message = error?.message || 'Failed to load chats';
        setConversationsError(message);
        toast.error(message);
      } finally {
        setConversationsLoading(false);
      }
    },
    [isAuthenticated]
  );

  const fetchConversationMessages = useCallback(
    async (conversation: ChatConversation) => {
      try {
        setMessagesLoading(true);
        setMessagesError(null);
        const response = await chatService.getConversationMessages(conversation.id, {
          limit: 50,
        });
        setMessages(response.messages);
        markConversationReadLocally(conversation.id);
        return response.messages;
      } catch (error: any) {
        console.error('Failed to load messages:', error);
        const message = error?.message || 'Failed to load messages';
        setMessagesError(message);
        toast.error(message);
        setMessages([]);
        return [];
      } finally {
        setMessagesLoading(false);
      }
    },
    [markConversationReadLocally]
  );

  const {
    connected: socketConnected,
    joinConversation,
    sendMessage,
    markRead,
    syncMissed,
    emitTyping,
  } = useChatSocket({
    enabled: isAuthenticated,
    token,

    // All callbacks read from refs, never from closed-over state.
    onMessageReceived: (payload) => {
      const uid = userIdRef.current;
      const activeCon = activeConversationRef.current;
      const incoming = chatService.normalizeSocketMessage(payload?.message, uid);

      setMessages((current) => {
        if (activeCon?.id !== payload?.conversationId) return current;
        return dedupeMessages([...current, incoming]);
      });

      setConversations((current) => {
        const existing = current.find((item) => item.id === payload?.conversationId);
        if (!existing) return current;

        const nextUnread =
          incoming.senderId === uid || activeCon?.id === payload?.conversationId
            ? 0
            : existing.unreadCount + 1;

        return sortConversations(
          current.map((item) =>
            item.id === payload?.conversationId
              ? {
                  ...item,
                  lastMessageText:
                    incoming.contentType === 'image' ? '[Image]' : incoming.content,
                  lastMessageAt: incoming.createdAt,
                  lastMessageSenderId: incoming.senderId,
                  unreadCount: nextUnread,
                }
              : item
          )
        );
      });

      if (activeCon?.id === payload?.conversationId && incoming.senderId !== uid) {
        markRead(payload.conversationId).catch(() => undefined);
        markConversationReadLocally(payload.conversationId);
      }
    },

    onMessageDelivered: (payload) => {
      const activeCon = activeConversationRef.current;
      if (activeCon?.id !== payload?.conversationId) return;
      patchMessageStatus(
        payload?.messageIds || [],
        'delivered',
        String(payload?.userId || '')
      );
    },

    onMessageRead: (payload) => {
      const activeCon = activeConversationRef.current;
      if (activeCon?.id !== payload?.conversationId) return;
      patchMessageStatus(
        payload?.messageIds || [],
        'read',
        String(payload?.userId || '')
      );
      if (String(payload?.userId || '') === userIdRef.current) {
        markConversationReadLocally(payload.conversationId);
      }
    },

    onTyping: (payload) => {
      const activeCon = activeConversationRef.current;
      if (
        payload?.conversationId !== activeCon?.id ||
        String(payload?.userId || '') === userIdRef.current
      ) {
        return;
      }
      setRemoteTyping(Boolean(payload?.isTyping));
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => setRemoteTyping(false), 1500);
    },
  });

  // Keep a ref to socketConnected so openConversation doesn't need it as a
  // dependency (which was causing the callback to be recreated on every
  // connect/disconnect, invalidating startConversationForVenue in turn).
  const socketConnectedRef = useRef(socketConnected);
  useEffect(() => {
    socketConnectedRef.current = socketConnected;
  }, [socketConnected]);

  const openConversation = useCallback(
    async (conversation: ChatConversation, options?: OpenConversationOptions) => {
      setActiveConversation(conversation);

      if (options?.openDrawer !== false) {
        setDrawerOpen(true);
      }

      const loadedMessages = await fetchConversationMessages(conversation);

      if (socketConnectedRef.current) {
        try {
          await joinConversation(conversation.id);
          await syncMissed(
            conversation.id,
            loadedMessages[loadedMessages.length - 1]?.createdAt
          );
          await markRead(conversation.id);
        } catch (error) {
          console.error('Failed to join chat conversation:', error);
        }
      }

      markConversationReadLocally(conversation.id);
    },
    // socketConnected removed from deps — using ref above instead.
    [fetchConversationMessages, joinConversation, markConversationReadLocally, markRead, syncMissed]
  );

  const startConversationForVenue = useCallback(
    async (venueId: string, options?: OpenConversationOptions) => {
      setStartingConversation(true);
      setStartingConversationError(null);

      if (options?.openDrawer !== false) {
        setDrawerOpen(true);
      }

      try {
        const conversation = await chatService.createOrGetConversation(venueId);
        upsertConversation(conversation);
        await openConversation(conversation, options);
      } catch (error: any) {
        const message = error?.message || 'Failed to start chat conversation';
        setStartingConversationError(message);
        throw error;
      } finally {
        setStartingConversation(false);
      }
    },
    [openConversation, upsertConversation]
  );

  const openChatPanel = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setStartingConversation(false);
    setStartingConversationError(null);
    setRemoteTyping(false);
    // Clear active conversation so shadcn Sheet fully releases its
    // body overflow/pointer-events lock on close.
    setActiveConversation(null);
    setMessages([]);
  }, []);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      const activeCon = activeConversationRef.current;
      if (!activeCon || !socketConnectedRef.current) return;
      emitTyping(activeCon.id, isTyping);
    },
    [emitTyping]
  );

  const sendTextMessage = useCallback(
    async (content: string) => {
      const activeCon = activeConversationRef.current;
      if (!activeCon) throw new Error('No active conversation selected');

      const trimmed = content.trim();
      if (!trimmed) return;

      const clientMessageId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg_${Date.now()}`;

      const response = await sendMessage({
        conversationId: activeCon.id,
        contentType: 'text',
        content: trimmed,
        clientMessageId,
      });

      const uid = userIdRef.current;
      const createdMessage = chatService.normalizeSocketMessage(response.message, uid);
      setMessages((current) => dedupeMessages([...current, createdMessage]));

      const updatedConversation: ChatConversation = {
        ...activeCon,
        lastMessageText: trimmed,
        lastMessageAt: createdMessage.createdAt,
        lastMessageSenderId: uid,
        unreadCount: 0,
      };

      setActiveConversation(updatedConversation);
      upsertConversation(updatedConversation);
    },
    [sendMessage, upsertConversation]
  );

  // Reset everything on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      setConversationsError(null);
      setMessages([]);
      setMessagesError(null);
      setActiveConversation(null);
      setStartingConversation(false);
      setStartingConversationError(null);
      setDrawerOpen(false);
      return;
    }
    loadConversations().catch(() => undefined);
  }, [isAuthenticated, loadConversations]);

  // Re-join + mark read whenever active conversation changes after socket connects
  useEffect(() => {
    if (!socketConnected || !activeConversation) return;
    joinConversation(activeConversation.id)
      .then(() => markRead(activeConversation.id))
      .catch((error) => console.error('Chat room join failed:', error));
  }, [activeConversation, joinConversation, markRead, socketConnected]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) => total + Number(conversation.unreadCount || 0),
        0
      ),
    [conversations]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      unreadTotal,
      conversations,
      conversationsLoading,
      conversationsError,
      messages,
      messagesLoading,
      messagesError,
      activeConversation,
      drawerOpen,
      startingConversation,
      startingConversationError,
      socketConnected,
      remoteTyping,
      loadConversations,
      openConversation,
      startConversationForVenue,
      openChatPanel,
      closeDrawer,
      setTyping,
      sendTextMessage,
    }),
    [
      unreadTotal,
      conversations,
      conversationsLoading,
      conversationsError,
      messages,
      messagesLoading,
      messagesError,
      activeConversation,
      drawerOpen,
      startingConversation,
      startingConversationError,
      socketConnected,
      remoteTyping,
      loadConversations,
      openConversation,
      startConversationForVenue,
      openChatPanel,
      closeDrawer,
      setTyping,
      sendTextMessage,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}