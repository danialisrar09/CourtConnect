const mongoose = require('mongoose');
const { Conversation, Message, Venue, User, UserProfile } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseUtils');

const CHAT_ENABLED = () =>
  String(process.env.CHAT_FEATURE_ENABLED || 'true').toLowerCase() === 'true';

const DEFAULT_CONV_LIMIT = 20;
const MAX_CONV_LIMIT = 100;
const DEFAULT_MSG_LIMIT = 30;
const MAX_MSG_LIMIT = 100;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

/**
 * Build a sanitized conversation payload for the requesting user.
 * conv can be a lean object; venueId can be a populated sub-doc or plain ObjectId.
 */
async function buildConversationPayload(conv, requestingUserId) {
  const uid = String(requestingUserId);
  const isCustomer = String(conv.customerId) === uid;
  const otherId = isCustomer ? conv.ownerId : conv.customerId;
  const otherRole = isCustomer ? 'business' : 'customer';

  const [otherUser, otherProfile] = await Promise.all([
    User.findById(otherId).select('name email').lean(),
    UserProfile.findOne({ userId: otherId }).select('avatar').lean(),
  ]);

  const otherName = otherUser?.name || otherUser?.email || 'Unknown';

  // venueId may be a populated object or a raw ObjectId (from lean)
  const venueIdRaw = conv.venueId?._id ?? conv.venueId;
  const venueName = conv.venueId?.title ?? null;

  // unreadCounts is a Map (Mongoose) or plain object (lean)
  let unreadCount = 0;
  if (conv.unreadCounts) {
    unreadCount =
      typeof conv.unreadCounts.get === 'function'
        ? conv.unreadCounts.get(uid) || 0
        : conv.unreadCounts[uid] || 0;
  }

  return {
    _id: conv._id,
    venueId: venueIdRaw,
    venueName,
    customerId: conv.customerId,
    ownerId: conv.ownerId,
    otherParticipant: {
      userId: otherId,
      name: otherName,
      avatar: otherProfile?.avatar || null,
      role: otherRole,
    },
    lastMessageText: conv.lastMessageText || '',
    lastMessageAt: conv.lastMessageAt || null,
    lastMessageSenderId: conv.lastMessageSenderId || null,
    unreadCount,
    status: conv.status,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// GET /api/chat/conversations
// List the requesting user's active conversations, newest-message-first.
// Query: ?limit=20  &cursor=<ISO-date>  &search=<name> (business owners only)
// ---------------------------------------------------------------------------
const getConversations = async (req, res) => {
  if (!CHAT_ENABLED()) return sendError(res, 503, 'Chat feature is currently disabled');

  try {
    const userId = req.user._id;
    const userRole = req.user.currentRole; // 'customer' | 'business'

    const limit = Math.min(parseInt(req.query.limit) || DEFAULT_CONV_LIMIT, MAX_CONV_LIMIT);
    const cursorRaw = req.query.cursor;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    // Base filter: conversations the user participates in
    const filter = {
      status: 'active',
      ...(userRole === 'business' ? { ownerId: userId } : { customerId: userId }),
    };

    // Cursor-based pagination: conversations older than this timestamp
    if (cursorRaw) {
      const cursorDate = new Date(cursorRaw);
      if (!isNaN(cursorDate.getTime())) {
        filter.lastMessageAt = { $lt: cursorDate };
      } else {
        return sendError(res, 400, 'cursor must be a valid ISO date string');
      }
    }

    // Business owner: name-search — resolve matching customer IDs first
    if (search && userRole === 'business') {
      const matchingCustomers = await User.find({
        name: { $regex: search, $options: 'i' },
      })
        .select('_id')
        .lean();
      const matchIds = matchingCustomers.map((u) => u._id);
      filter.customerId = { $in: matchIds };
    }

    const rawConvs = await Conversation.find(filter)
      .populate('venueId', 'title sport location')
      .sort({ lastMessageAt: -1 })
      .limit(limit + 1) // one extra to detect hasMore
      .lean();

    const hasMore = rawConvs.length > limit;
    if (hasMore) rawConvs.pop();

    const payloads = await Promise.all(
      rawConvs.map((conv) => buildConversationPayload(conv, userId))
    );

    const nextCursor =
      hasMore && rawConvs.length > 0
        ? rawConvs[rawConvs.length - 1].lastMessageAt?.toISOString() ?? null
        : null;

    return sendSuccess(res, 200, 'Conversations retrieved', {
      conversations: payloads,
      pagination: { limit, hasMore, nextCursor },
    });
  } catch (err) {
    console.error('[chatController] getConversations error:', err);
    return sendError(res, 500, 'Failed to retrieve conversations');
  }
};

// ---------------------------------------------------------------------------
// GET /api/chat/conversations/:id/messages
// Cursor-paginated message history for a conversation.
// Query: ?limit=30  &before=<message _id>   (loads messages older than that ID)
// Returns messages in ascending (chronological) order.
// ---------------------------------------------------------------------------
const getConversationMessages = async (req, res) => {
  if (!CHAT_ENABLED()) return sendError(res, 503, 'Chat feature is currently disabled');

  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid conversation ID');

    const conversation = await Conversation.findById(id).lean();
    if (!conversation) return sendError(res, 404, 'Conversation not found');

    // Authorization: requesting user must be a participant
    const isParticipant = conversation.participants.some(
      (p) => String(p.userId) === String(userId)
    );
    if (!isParticipant) {
      return sendError(res, 403, 'You are not a participant in this conversation');
    }

    const limit = Math.min(parseInt(req.query.limit) || DEFAULT_MSG_LIMIT, MAX_MSG_LIMIT);
    const before = req.query.before; // message _id — page backwards from here

    const filter = { conversationId: new mongoose.Types.ObjectId(id) };

    if (before) {
      if (!isValidObjectId(before)) return sendError(res, 400, 'Invalid cursor (before) value');
      const anchor = await Message.findById(before).select('createdAt').lean();
      if (!anchor) return sendError(res, 400, 'Cursor message not found');
      filter.createdAt = { $lt: anchor.createdAt };
    }

    // Fetch newest-first so $limit grabs the closest messages to the cursor,
    // then reverse to return ascending (chronological) order to the client.
    const rawMsgs = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rawMsgs.length > limit;
    if (hasMore) rawMsgs.pop();

    rawMsgs.reverse(); // oldest → newest

    const uidStr = String(userId);
    const publicMessages = rawMsgs.map((msg) => {
      const myEntry = msg.statusByUser?.find((s) => String(s.userId) === uidStr);
      return {
        _id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderRole: msg.senderRole,
        contentType: msg.contentType,
        content: msg.content || '',
        image: msg.image || null,
        clientMessageId: msg.clientMessageId || null,
        myStatus: myEntry?.status || 'sent',
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      };
    });

    // Cursor for the next (older) page = the oldest returned message's _id
    const nextCursor =
      hasMore && rawMsgs.length > 0 ? String(rawMsgs[0]._id) : null;

    return sendSuccess(res, 200, 'Messages retrieved', {
      messages: publicMessages,
      pagination: { limit, hasMore, nextCursor },
    });
  } catch (err) {
    console.error('[chatController] getConversationMessages error:', err);
    return sendError(res, 500, 'Failed to retrieve messages');
  }
};

// ---------------------------------------------------------------------------
// POST /api/chat/conversations
// Create or get an existing active conversation between a customer and a venue owner.
// Body: { venueId }
// Only customers may initiate; business owners discover chats through the list.
// ---------------------------------------------------------------------------
const createOrGetConversation = async (req, res) => {
  if (!CHAT_ENABLED()) return sendError(res, 503, 'Chat feature is currently disabled');

  try {
    const userId = req.user._id;
    // Fall back to profileType if currentRole is absent (e.g. accounts created before the
    // field was added to the schema).  Treat profileType 'both' as 'customer' by default.
    const userRole =
      req.user.currentRole ||
      (req.user.profileType === 'both' ? 'customer' : req.user.profileType);
    const { venueId } = req.body;

    if (!venueId) return sendError(res, 400, 'venueId is required');
    if (!isValidObjectId(venueId)) return sendError(res, 400, 'venueId must be a valid ID');

    if (userRole !== 'customer') {
      return sendError(
        res,
        403,
        'Only customers can initiate conversations. Business owners access chats through the conversation list.'
      );
    }

    const venue = await Venue.findById(venueId).select('owner title status').lean();
    if (!venue) return sendError(res, 404, 'Venue not found');
    if (venue.status !== 'active') {
      return sendError(res, 400, 'Cannot start a chat for an inactive venue');
    }

    const ownerId = venue.owner;
    const customerId = userId;

    if (String(customerId) === String(ownerId)) {
      return sendError(res, 400, 'You cannot start a chat with your own venue');
    }

    // Try to find an existing active conversation for this trio
    let conversation = await Conversation.findOne({
      customerId,
      ownerId,
      venueId,
      status: 'active',
    }).lean();

    let created = false;

    if (!conversation) {
      const newConv = await Conversation.create({
        customerId,
        ownerId,
        venueId,
        participants: [
          { userId: customerId, role: 'customer' },
          { userId: ownerId, role: 'business' },
        ],
        status: 'active',
      });
      conversation = newConv.toObject();
      created = true;
    }

    const payload = await buildConversationPayload(
      { ...conversation, venueId: { _id: venueId, title: venue.title } },
      userId
    );

    return sendSuccess(
      res,
      created ? 201 : 200,
      created ? 'Conversation created' : 'Conversation already exists',
      { conversation: payload }
    );
  } catch (err) {
    // Race condition: another request created the conversation at the same time
    if (err.code === 11000) {
      try {
        const { venueId } = req.body;
        const venue = await Venue.findById(venueId).select('owner title').lean();
        const existing = await Conversation.findOne({
          customerId: req.user._id,
          ownerId: venue?.owner,
          venueId,
          status: 'active',
        }).lean();
        if (existing) {
          const payload = await buildConversationPayload(
            { ...existing, venueId: { _id: venueId, title: venue?.title } },
            req.user._id
          );
          return sendSuccess(res, 200, 'Conversation already exists', { conversation: payload });
        }
      } catch (_) {
        // fall through to generic error
      }
    }
    console.error('[chatController] createOrGetConversation error:', err);
    return sendError(res, 500, 'Failed to create or retrieve conversation');
  }
};

// ---------------------------------------------------------------------------
// GET /api/chat/health
// ---------------------------------------------------------------------------
const getChatHealth = async (req, res) => {
  return sendSuccess(res, 200, 'Chat module health', {
    featureEnabled: CHAT_ENABLED(),
    maxMessageLength: Number(process.env.CHAT_MAX_MESSAGE_LENGTH || 1000),
    rateLimitPerMinute: Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE || 40),
  });
};

module.exports = {
  getConversations,
  getConversationMessages,
  createOrGetConversation,
  getChatHealth,
};
