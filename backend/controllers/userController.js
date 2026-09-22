const { User, UserProfile, UserSession } = require('../models');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const { sendSuccess, sendError } = require('../utils/responseUtils');

/**
 * Get user profile
 * @route GET /api/users/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    const profile = await UserProfile.findOne({ userId });
    
    const userData = {
      ...user.toJSON(),
      profile: profile || null
    };
    
    return sendSuccess(res, 200, 'Profile retrieved successfully', userData);
    
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Failed to fetch profile');
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone } = req.body;
    
    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    const profile = await UserProfile.findOne({ userId });
    
    const userData = {
      ...user.toJSON(),
      profile: profile || null
    };
    
    return sendSuccess(res, 200, 'Profile updated successfully', userData);
    
  } catch (error) {
    console.error('Update profile error:', error);
    return sendError(res, 500, 'Failed to update profile');
  }
};

/**
 * Change password
 * @route POST /api/users/change-password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return sendError(res, 400, 'Current password is incorrect');
    }
    
    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();
    
    // Invalidate all sessions except current one
    await UserSession.updateMany(
      { userId, token: { $ne: req.token } },
      { isActive: false }
    );
    
    return sendSuccess(res, 200, 'Password changed successfully');
    
  } catch (error) {
    console.error('Change password error:', error);
    return sendError(res, 500, 'Failed to change password');
  }
};

/**
 * Delete user account
 * @route DELETE /api/users/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;
    
    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return sendError(res, 400, 'Password is incorrect');
    }
    
    // Soft delete - deactivate user
    user.isActive = false;
    await user.save();
    
    // Invalidate all sessions
    await UserSession.updateMany(
      { userId },
      { isActive: false }
    );
    
    return sendSuccess(res, 200, 'Account deleted successfully');
    
  } catch (error) {
    console.error('Delete account error:', error);
    return sendError(res, 500, 'Failed to delete account');
  }
};

/**
 * Get user sessions
 * @route GET /api/users/sessions
 */
const getSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const sessions = await UserSession.find({ 
      userId, 
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
    .select('deviceInfo lastActivity createdAt')
    .sort({ lastActivity: -1 });
    
    return sendSuccess(res, 200, 'Sessions retrieved successfully', sessions);
    
  } catch (error) {
    console.error('Get sessions error:', error);
    return sendError(res, 500, 'Failed to fetch sessions');
  }
};

/**
 * Revoke a session
 * @route DELETE /api/users/sessions/:sessionId
 */
const revokeSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.params;
    
    const session = await UserSession.findOne({ 
      _id: sessionId, 
      userId 
    });
    
    if (!session) {
      return sendError(res, 404, 'Session not found');
    }
    
    session.isActive = false;
    await session.save();
    
    return sendSuccess(res, 200, 'Session revoked successfully');
    
  } catch (error) {
    console.error('Revoke session error:', error);
    return sendError(res, 500, 'Failed to revoke session');
  }
};

/**
 * Get user's favorite venues
 * @route GET /api/users/favorites
 */
const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    const profile = await UserProfile.findOne({ userId }).populate('favorites');
    if (!profile) {
      return sendSuccess(res, 200, 'No favorites found', []);
    }
    return sendSuccess(res, 200, 'Favorites retrieved successfully', profile.favorites || []);
  } catch (error) {
    console.error('Get favorites error:', error);
    return sendError(res, 500, 'Failed to fetch favorites');
  }
};

/**
 * Add a venue to user's favorites
 * @route POST /api/users/favorites
 */
const addFavorite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { venueId } = req.body;
    if (!venueId) {
      return sendError(res, 400, 'Venue ID is required');
    }
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $addToSet: { favorites: venueId } },
      { new: true, upsert: true }
    ).populate('favorites');
    return sendSuccess(res, 200, 'Venue added to favorites', profile.favorites);
  } catch (error) {
    console.error('Add favorite error:', error);
    return sendError(res, 500, 'Failed to add favorite');
  }
};

/**
 * Remove a venue from user's favorites
 * @route DELETE /api/users/favorites/:venueId
 */
const removeFavorite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { venueId } = req.params;
    if (!venueId) {
      return sendError(res, 400, 'Venue ID is required');
    }
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $pull: { favorites: venueId } },
      { new: true }
    ).populate('favorites');
    return sendSuccess(res, 200, 'Venue removed from favorites', profile.favorites);
  } catch (error) {
    console.error('Remove favorite error:', error);
    return sendError(res, 500, 'Failed to remove favorite');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getSessions,
  revokeSession,
  getFavorites,
  addFavorite,
  removeFavorite
};
