const express = require('express');
const router = express.Router();
const {
  getRecommendations,
  chatWithGemini,
} = require('../controllers/aiController');
const { nlpSearch } = require('../controllers/nlpSearchController');
const { authenticate } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const { chatValidation } = require('../validations/aiValidation');

// @route   GET /api/ai/recommend
// @desc    Get AI-powered venue recommendations
// @access  Public
router.get('/recommend', getRecommendations);

// @route   POST /api/ai/chat
// @desc    Chat with Gemini assistant for in-app guidance
// @access  Private
router.post('/chat', authenticate, chatValidation, handleValidationErrors, chatWithGemini);

// @route   POST /api/ai/nlp-search
// @desc    Extract structured search intent from a natural-language query using
//          Grok API / llama-3.3-70b-versatile (falls back to regex/keyword if Grok is unavailable)
// @access  Public — no authentication required
router.post('/nlp-search', nlpSearch);

module.exports = router;
