const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getConversations,
  getConversationMessages,
  createOrGetConversation,
  getChatHealth,
} = require('../controllers/chatController');

// @route   GET /api/chat/health
// @desc    Chat module health/status
// @access  Private
router.get('/health', authenticate, getChatHealth);

// @route   GET /api/chat/conversations
// @desc    List user's chat conversations
// @access  Private
router.get('/conversations', authenticate, getConversations);

// @route   POST /api/chat/conversations
// @desc    Create or get a conversation
// @access  Private
router.post('/conversations', authenticate, createOrGetConversation);

// @route   GET /api/chat/conversations/:id/messages
// @desc    List messages for a conversation
// @access  Private
router.get('/conversations/:id/messages', authenticate, getConversationMessages);

module.exports = router;
