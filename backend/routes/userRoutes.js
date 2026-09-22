const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors
} = require('../middleware/validationMiddleware');

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  userController.getProfile
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  updateProfileValidation,
  handleValidationErrors,
  userController.updateProfile
);

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  changePasswordValidation,
  handleValidationErrors,
  userController.changePassword
);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 */
router.delete(
  '/account',
  authenticate,
  userController.deleteAccount
);

/**
 * @route   GET /api/users/sessions
 * @desc    Get all active sessions
 * @access  Private
 */
router.get(
  '/sessions',
  authenticate,
  userController.getSessions
);

/**
 * @route   DELETE /api/users/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  authenticate,
  userController.revokeSession
);

/**
 * @route   POST /api/users/favorites
 * @desc    Add a venue to user's favorites
 * @access  Private
 */
router.post(
  '/favorites',
  authenticate,
  userController.addFavorite
);

/**
 * @route   GET /api/users/favorites
 * @desc    Get user's favorite venues
 * @access  Private
 */
router.get(
  '/favorites',
  authenticate,
  userController.getFavorites
);

/**
 * @route   DELETE /api/users/favorites/:venueId
 * @desc    Remove a venue from user's favorites
 * @access  Private
 */
router.delete(
  '/favorites/:venueId',
  authenticate,
  userController.removeFavorite
);

module.exports = router;
