import { api } from './api';

export interface ChatParticipantSummary {
  userId: string;
  name: string;
  avatar: string | null;
  role: 'customer' | 'business';
}

export interface ChatConversation {
  id: string;
  venueId: string;
  venueName: string | null;
  customerId: string;
  ownerId: string;
  otherParticipant: ChatParticipantSummary;
  lastMessageText: string;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'customer' | 'business';
  contentType: 'text' | 'image' | 'text_image';
  content: string;
  image: {
    url: string;
    mimeType?: string;
    sizeBytes?: number;
  } | null;
  clientMessageId: string | null;
  myStatus: 'sent' | 'delivered' | 'read';
  createdAt: string;
  updatedAt: string;
}

interface ChatPagination<TCursor = string | null> {
  limit: number;
  hasMore: boolean;
  nextCursor: TCursor;
}

interface ChatConversationsResponse {
  conversations: ChatConversation[];
  pagination: ChatPagination<string | null>;
}

interface ChatMessagesResponse {
  messages: ChatMessage[];
  pagination: ChatPagination<string | null>;
}

const normalizeConversation = (conversation: any): ChatConversation => ({
  id: String(conversation.id || conversation._id),
  venueId: String(conversation.venueId || ''),
  venueName: conversation.venueName || null,
  customerId: String(conversation.customerId || ''),
  ownerId: String(conversation.ownerId || ''),
  otherParticipant: {
    userId: String(conversation.otherParticipant?.userId || ''),
    name: conversation.otherParticipant?.name || 'Unknown user',
    avatar: conversation.otherParticipant?.avatar || null,
    role: conversation.otherParticipant?.role === 'business' ? 'business' : 'customer',
  },
  lastMessageText: conversation.lastMessageText || '',
  lastMessageAt: conversation.lastMessageAt || null,
  lastMessageSenderId: conversation.lastMessageSenderId ? String(conversation.lastMessageSenderId) : null,
  unreadCount: Number(conversation.unreadCount || 0),
  status: conversation.status === 'archived' ? 'archived' : 'active',
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const normalizeMessage = (message: any): ChatMessage => ({
  id: String(message.id || message._id),
  conversationId: String(message.conversationId || ''),
  senderId: String(message.senderId || ''),
  senderRole: message.senderRole === 'business' ? 'business' : 'customer',
  contentType: message.contentType === 'image' || message.contentType === 'text_image' ? message.contentType : 'text',
  content: message.content || '',
  image: message.image || null,
  clientMessageId: message.clientMessageId || null,
  myStatus: message.myStatus === 'read' || message.myStatus === 'delivered' ? message.myStatus : 'sent',
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

class ChatService {
  async getConversations(params?: { limit?: number; cursor?: string; search?: string }): Promise<ChatConversationsResponse> {
    const response = await api.get('/chat/conversations', { params });
    const data = response.data?.data || {};

    return {
      conversations: Array.isArray(data.conversations) ? data.conversations.map(normalizeConversation) : [],
      pagination: {
        limit: Number(data.pagination?.limit || params?.limit || 20),
        hasMore: Boolean(data.pagination?.hasMore),
        nextCursor: data.pagination?.nextCursor || null,
      },
    };
  }

  async getConversationMessages(
    conversationId: string,
    params?: { limit?: number; before?: string }
  ): Promise<ChatMessagesResponse> {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
    const data = response.data?.data || {};

    return {
      messages: Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [],
      pagination: {
        limit: Number(data.pagination?.limit || params?.limit || 30),
        hasMore: Boolean(data.pagination?.hasMore),
        nextCursor: data.pagination?.nextCursor || null,
      },
    };
  }

  async createOrGetConversation(venueId: string): Promise<ChatConversation> {
    const response = await api.post('/chat/conversations', { venueId });
    return normalizeConversation(response.data?.data?.conversation || {});
  }

  normalizeSocketMessage(message: any, currentUserId: string): ChatMessage {
    const statusByUser = Array.isArray(message?.statusByUser) ? message.statusByUser : [];
    const myStatusEntry = statusByUser.find((entry: any) => String(entry.userId) === String(currentUserId));

    return normalizeMessage({
      ...message,
      myStatus: myStatusEntry?.status || 'sent',
    });
  }
}

export default new ChatService();