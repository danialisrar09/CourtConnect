const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/chatSocketAuth');
const mongoose = require('mongoose');
const { Conversation, Message } = require('../models');

const isChatFeatureEnabled = () => String(process.env.CHAT_FEATURE_ENABLED || 'true').toLowerCase() === 'true';
const MAX_MESSAGE_LENGTH = Number(process.env.CHAT_MAX_MESSAGE_LENGTH || 1000);

const normalizeRole = (user = {}) => {
  const role = String(user.currentRole || user.profileType || 'customer').toLowerCase();
  return role === 'business' ? 'business' : 'customer';
};

const sanitizeText = (value) => String(value || '').trim();

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const toPublicMessage = (messageDoc) => {
  const payload = messageDoc.toObject ? messageDoc.toObject() : messageDoc;
  return {
    id: String(payload._id),
    conversationId: String(payload.conversationId),
    senderId: String(payload.senderId),
    senderRole: payload.senderRole,
    contentType: payload.contentType,
    content: payload.content || '',
    image: payload.image || null,
    clientMessageId: payload.clientMessageId || null,
    statusByUser: Array.isArray(payload.statusByUser)
      ? payload.statusByUser.map((s) => ({
          userId: String(s.userId),
          status: s.status,
          updatedAt: s.updatedAt,
        }))
      : [],
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
};

const getAuthorizedConversation = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return { error: 'Invalid conversationId' };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: 'Conversation not found' };
  }

  const isParticipant = (conversation.participants || []).some(
    (p) => String(p.userId) === String(userId)
  );

  if (!isParticipant) {
    return { error: 'Access denied: user is not a participant of this conversation' };
  }

  return { conversation };
};

const markConversationDeliveredForUser = async (conversationId, userId) => {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));

  const deliveredMessageIds = await Message.find({
    conversationId,
    senderId: { $ne: userObjectId },
    statusByUser: {
      $elemMatch: {
        userId: userObjectId,
        status: 'sent',
      },
    },
  })
    .select('_id')
    .limit(300)
    .lean();

  if (!deliveredMessageIds.length) {
    return [];
  }

  const ids = deliveredMessageIds.map((item) => item._id);
  const now = new Date();

  await Message.updateMany(
    {
      _id: { $in: ids },
      statusByUser: {
        $elemMatch: {
          userId: userObjectId,
          status: 'sent',
        },
      },
    },
    {
      $set: {
        'statusByUser.$.status': 'delivered',
        'statusByUser.$.updatedAt': now,
      },
    }
  );

  return ids.map((id) => String(id));
};

const markConversationReadForUser = async (conversationId, userId, messageIds = null) => {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const query = {
    conversationId,
    senderId: { $ne: userObjectId },
    statusByUser: {
      $elemMatch: {
        userId: userObjectId,
        status: { $in: ['sent', 'delivered'] },
      },
    },
  };

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    const validIds = messageIds.filter((id) => isValidObjectId(id));
    if (validIds.length > 0) {
      query._id = { $in: validIds };
    }
  }

  const candidates = await Message.find(query).select('_id').limit(500).lean();
  if (!candidates.length) {
    return [];
  }

  const ids = candidates.map((item) => item._id);
  const now = new Date();

  await Message.updateMany(
    {
      _id: { $in: ids },
      statusByUser: {
        $elemMatch: {
          userId: userObjectId,
          status: { $in: ['sent', 'delivered'] },
        },
      },
    },
    {
      $set: {
        'statusByUser.$.status': 'read',
        'statusByUser.$.updatedAt': now,
      },
    }
  );

  return ids.map((id) => String(id));
};

const initializeChatSocket = (httpServer, { corsOrigin }) => {
  if (!isChatFeatureEnabled()) {
    console.log('[CHAT_SOCKET] Feature disabled (CHAT_FEATURE_ENABLED=false).');
    return null;
  }

  const pingInterval = Number(process.env.CHAT_PING_INTERVAL_MS || 25000);
  const pingTimeout = Number(process.env.CHAT_PING_TIMEOUT_MS || 60000);

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    pingInterval,
    pingTimeout,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString?.() || 'unknown';
    const role = normalizeRole(socket.user);
    const joinedConversations = new Set();

    console.log(`[CHAT_SOCKET] Connected user=${userId} role=${role} socket=${socket.id}`);

    socket.join(`user:${userId}`);

    socket.emit('chat:connected', {
      success: true,
      message: 'Connected to chat socket server',
      userId,
      role,
      ts: new Date().toISOString(),
    });

    socket.on('chat:join_conversation', async (payload = {}, ack) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        if (!conversationId) {
          if (typeof ack === 'function') {
            ack({ success: false, message: 'conversationId is required' });
          }
          return;
        }

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) {
          if (typeof ack === 'function') {
            ack({ success: false, message: authorized.error });
          }
          return;
        }

        socket.join(`conversation:${conversationId}`);
        joinedConversations.add(conversationId);

        const deliveredIds = await markConversationDeliveredForUser(conversationId, userId);
        if (deliveredIds.length > 0) {
          io.to(`conversation:${conversationId}`).emit('chat:message_delivered', {
            conversationId,
            userId,
            messageIds: deliveredIds,
            ts: new Date().toISOString(),
          });
        }

        if (typeof ack === 'function') {
          ack({
            success: true,
            conversationId,
            deliveredMessageIds: deliveredIds,
            serverTime: new Date().toISOString(),
          });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ success: false, message: error.message || 'Failed to join conversation' });
        }
      }
    });

    socket.on('chat:send_message', async (payload = {}, ack) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        const contentType = String(payload.contentType || 'text').trim();
        const content = sanitizeText(payload.content);
        const image = payload.image && typeof payload.image === 'object' ? payload.image : undefined;
        const clientMessageId = sanitizeText(payload.clientMessageId) || null;

        if (!conversationId) {
          if (typeof ack === 'function') ack({ success: false, message: 'conversationId is required' });
          return;
        }

        const allowedTypes = ['text', 'image', 'text_image'];
        if (!allowedTypes.includes(contentType)) {
          if (typeof ack === 'function') ack({ success: false, message: 'Invalid contentType' });
          return;
        }

        if (content.length > MAX_MESSAGE_LENGTH) {
          if (typeof ack === 'function') {
            ack({ success: false, message: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` });
          }
          return;
        }

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) {
          if (typeof ack === 'function') ack({ success: false, message: authorized.error });
          return;
        }

        const conversation = authorized.conversation;
        const participants = (conversation.participants || []).map((p) => String(p.userId));

        const now = new Date();
        const statusByUser = participants.map((participantId) => ({
          userId: participantId,
          status: participantId === userId ? 'read' : 'sent',
          updatedAt: now,
        }));

        const messagePayload = {
          conversationId,
          senderId: userId,
          senderRole: role,
          contentType,
          content,
          clientMessageId,
          statusByUser,
        };

        if (image) {
          messagePayload.image = {
            url: sanitizeText(image.url),
            mimeType: sanitizeText(image.mimeType),
            sizeBytes: Number(image.sizeBytes) || 0,
          };
        }

        let messageDoc;
        try {
          messageDoc = await Message.create(messagePayload);
        } catch (error) {
          if (error && error.code === 11000 && clientMessageId) {
            const existing = await Message.findOne({ conversationId, clientMessageId }).lean();
            if (existing) {
              if (typeof ack === 'function') {
                ack({
                  success: true,
                  duplicated: true,
                  message: toPublicMessage(existing),
                });
              }
              return;
            }
          }
          throw error;
        }

        const lastMessageText =
          contentType === 'text'
            ? content
            : contentType === 'image'
            ? '[Image]'
            : `${content || ''} [Image]`.trim();

        const unreadCounts = new Map(conversation.unreadCounts || []);
        participants.forEach((participantId) => {
          const previous = Number(unreadCounts.get(participantId) || 0);
          unreadCounts.set(participantId, participantId === userId ? 0 : previous + 1);
        });

        conversation.lastMessageText = lastMessageText;
        conversation.lastMessageAt = messageDoc.createdAt;
        conversation.lastMessageSenderId = userId;
        conversation.unreadCounts = unreadCounts;
        await conversation.save();

        const message = toPublicMessage(messageDoc);
        io.to(`conversation:${conversationId}`).emit('chat:message_received', {
          conversationId,
          message,
          ts: new Date().toISOString(),
        });

        if (typeof ack === 'function') {
          ack({ success: true, conversationId, message });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ success: false, message: error.message || 'Failed to send message' });
        }
      }
    });

    socket.on('chat:message_delivered', async (payload = {}, ack) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds : [];
        if (!conversationId) {
          if (typeof ack === 'function') ack({ success: false, message: 'conversationId is required' });
          return;
        }

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) {
          if (typeof ack === 'function') ack({ success: false, message: authorized.error });
          return;
        }

        let deliveredIds = [];
        if (messageIds.length > 0) {
          const validIds = messageIds.filter((id) => isValidObjectId(id));
          if (validIds.length > 0) {
            const now = new Date();
            await Message.updateMany(
              {
                _id: { $in: validIds },
                conversationId,
                senderId: { $ne: userId },
                statusByUser: {
                  $elemMatch: {
                    userId,
                    status: 'sent',
                  },
                },
              },
              {
                $set: {
                  'statusByUser.$.status': 'delivered',
                  'statusByUser.$.updatedAt': now,
                },
              }
            );
            deliveredIds = validIds.map((id) => String(id));
          }
        } else {
          deliveredIds = await markConversationDeliveredForUser(conversationId, userId);
        }

        if (deliveredIds.length > 0) {
          io.to(`conversation:${conversationId}`).emit('chat:message_delivered', {
            conversationId,
            userId,
            messageIds: deliveredIds,
            ts: new Date().toISOString(),
          });
        }

        if (typeof ack === 'function') {
          ack({ success: true, conversationId, messageIds: deliveredIds });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ success: false, message: error.message || 'Failed to mark messages delivered' });
        }
      }
    });

    socket.on('chat:mark_read', async (payload = {}, ack) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds : null;
        if (!conversationId) {
          if (typeof ack === 'function') ack({ success: false, message: 'conversationId is required' });
          return;
        }

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) {
          if (typeof ack === 'function') ack({ success: false, message: authorized.error });
          return;
        }

        const readIds = await markConversationReadForUser(conversationId, userId, messageIds);
        authorized.conversation.unreadCounts.set(userId, 0);
        await authorized.conversation.save();

        if (readIds.length > 0) {
          io.to(`conversation:${conversationId}`).emit('chat:message_read', {
            conversationId,
            userId,
            messageIds: readIds,
            ts: new Date().toISOString(),
          });
        }

        if (typeof ack === 'function') {
          ack({ success: true, conversationId, messageIds: readIds });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ success: false, message: error.message || 'Failed to mark messages read' });
        }
      }
    });

    socket.on('chat:typing', async (payload = {}) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        if (!conversationId) return;

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) return;

        socket.to(`conversation:${conversationId}`).emit('chat:typing', {
          conversationId,
          userId,
          isTyping: Boolean(payload.isTyping),
          ts: new Date().toISOString(),
        });
      } catch (error) {
        console.warn(`[CHAT_SOCKET] typing event failed user=${userId}: ${error.message}`);
      }
    });

    socket.on('chat:sync_missed', async (payload = {}, ack) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        const since = parseDate(payload.since);
        const limit = Math.min(Math.max(Number(payload.limit) || 50, 1), 200);

        if (!conversationId) {
          if (typeof ack === 'function') ack({ success: false, message: 'conversationId is required' });
          return;
        }

        const authorized = await getAuthorizedConversation(conversationId, userId);
        if (authorized.error) {
          if (typeof ack === 'function') ack({ success: false, message: authorized.error });
          return;
        }

        const query = { conversationId };
        if (since) {
          query.createdAt = { $gt: since };
        }

        const missed = await Message.find(query)
          .sort({ createdAt: 1 })
          .limit(limit)
          .lean();

        const deliveredIds = await markConversationDeliveredForUser(conversationId, userId);
        if (deliveredIds.length > 0) {
          io.to(`conversation:${conversationId}`).emit('chat:message_delivered', {
            conversationId,
            userId,
            messageIds: deliveredIds,
            ts: new Date().toISOString(),
          });
        }

        if (typeof ack === 'function') {
          ack({
            success: true,
            conversationId,
            messages: missed.map((m) => toPublicMessage(m)),
            deliveredMessageIds: deliveredIds,
            serverTime: new Date().toISOString(),
          });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ success: false, message: error.message || 'Failed to sync missed messages' });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      if (joinedConversations.size > 0) {
        console.log(`[CHAT_SOCKET] User=${userId} left ${joinedConversations.size} conversation room(s)`);
      }
      console.log(`[CHAT_SOCKET] Disconnected user=${userId} socket=${socket.id} reason=${reason}`);
    });
  });

  console.log(`[CHAT_SOCKET] Socket.IO initialized (pingInterval=${pingInterval}ms, pingTimeout=${pingTimeout}ms).`);
  return io;
};

module.exports = {
  initializeChatSocket,
  isChatFeatureEnabled,
};
