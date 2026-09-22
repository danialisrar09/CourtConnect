const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forgotPassword } = require('../controllers/forgotPasswordController');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter, registerLimiter } = require('../middleware/rateLimitMiddleware');
const {
  registerValidation,
  loginValidation,
  switchProfileValidation,
  handleValidationErrors
} = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerLimiter,
  registerValidation,
  handleValidationErrors,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  loginValidation,
  handleValidationErrors,
  authController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate session)
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route   POST /api/auth/switch-profile
 * @desc    Switch between customer and business profile
 * @access  Private
 */
router.post(
  '/switch-profile',
  authenticate,
  switchProfileValidation,
  handleValidationErrors,
  authController.switchProfile
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.get(
  '/verify',
  authenticate,
  authController.verifyToken
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset link
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

module.exports = router;
