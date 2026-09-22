import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type AckResponse = Record<string, any>;

interface UseChatSocketOptions {
  enabled: boolean;
  token: string | null;
  onMessageReceived?: (payload: any) => void;
  onMessageDelivered?: (payload: any) => void;
  onMessageRead?: (payload: any) => void;
  onTyping?: (payload: any) => void;
}

const getSocketBaseUrl = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
  return apiUrl.replace(/\/api\/?$/, '');
};

const emitWithAck = <T extends AckResponse>(socket: Socket | null, eventName: string, payload: Record<string, any>) => {
  return new Promise<T>((resolve, reject) => {
    if (!socket) {
      reject(new Error('Chat socket is not connected'));
      return;
    }

    socket.emit(eventName, payload, (response: T) => {
      if (response?.success === false) {
        reject(new Error(response.message || 'Chat socket request failed'));
        return;
      }

      resolve(response);
    });
  });
};

export function useChatSocket(options: UseChatSocketOptions) {
  const { enabled, token, onMessageReceived, onMessageDelivered, onMessageRead, onTyping } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const messageReceivedRef = useRef(onMessageReceived);
  const messageDeliveredRef = useRef(onMessageDelivered);
  const messageReadRef = useRef(onMessageRead);
  const typingRef = useRef(onTyping);

  useEffect(() => {
    messageReceivedRef.current = onMessageReceived;
    messageDeliveredRef.current = onMessageDelivered;
    messageReadRef.current = onMessageRead;
    typingRef.current = onTyping;
  }, [onMessageDelivered, onMessageRead, onMessageReceived, onTyping]);

  const socketUrl = useMemo(() => getSocketBaseUrl(), []);

  useEffect(() => {
    if (!enabled || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    const socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('chat:message_received', (payload) => messageReceivedRef.current?.(payload));
    socket.on('chat:message_delivered', (payload) => messageDeliveredRef.current?.(payload));
    socket.on('chat:message_read', (payload) => messageReadRef.current?.(payload));
    socket.on('chat:typing', (payload) => typingRef.current?.(payload));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, socketUrl, token]);

  return {
    connected,
    joinConversation: (conversationId: string) =>
      emitWithAck(socketRef.current, 'chat:join_conversation', { conversationId }),
    sendMessage: (payload: Record<string, any>) =>
      emitWithAck(socketRef.current, 'chat:send_message', payload),
    markRead: (conversationId: string, messageIds?: string[]) =>
      emitWithAck(socketRef.current, 'chat:mark_read', { conversationId, messageIds }),
    syncMissed: (conversationId: string, since?: string) =>
      emitWithAck(socketRef.current, 'chat:sync_missed', { conversationId, since }),
    emitTyping: (conversationId: string, isTyping: boolean) => {
      socketRef.current?.emit('chat:typing', { conversationId, isTyping });
    },
  };
}