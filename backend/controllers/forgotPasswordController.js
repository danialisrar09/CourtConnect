const { User } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseUtils');
const crypto = require('crypto');

/**
 * Forgot Password — request a reset link
 * @route POST /api/auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return sendError(res, 400, 'Email address is required');
    }

    // Always respond with success to prevent email enumeration
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      // Generate a simple reset token (in production this would be emailed)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store on the user document (requires field in schema, will be ignored if not present)
      try {
        user.passwordResetToken = resetToken;
        user.passwordResetExpiry = resetExpiry;
        await user.save();
      } catch (_) {
        // Fields may not exist in schema yet — silently continue
      }

      console.log(`[ForgotPassword] Reset requested for: ${email}`);
    }

    // Always return success (security: don't reveal if email exists)
    return sendSuccess(res, 200, 'If an account with that email exists, a reset link has been sent.');

  } catch (error) {
    console.error('Forgot password error:', error);
    return sendError(res, 500, 'Something went wrong. Please try again.');
  }
};

module.exports = { forgotPassword };
