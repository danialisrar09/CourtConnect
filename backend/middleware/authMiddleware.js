const { verifyToken } = require('../utils/jwtUtils');
const { User, UserSession } = require('../models');
const { sendError } = require('../utils/responseUtils');

/**
 * Middleware to authenticate user via JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Check if session exists and is active
    const session = await UserSession.findOne({ 
      token, 
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!session) {
      return sendError(res, 401, 'Invalid or expired session');
    }
    
    // Get user
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return sendError(res, 401, 'User not found or inactive');
    }
    
    // Update session last activity
    session.lastActivity = new Date();
    await session.save();
    
    // Attach user to request
    req.user = user;
    req.token = token;
    req.session = session;
    
    next();
  } catch (error) {
    return sendError(res, 401, 'Invalid token');
  }
};

/**
 * Middleware to check if user has specific role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    
    const userRole = req.user.currentRole || req.user.profileType;
    
    if (!roles.includes(userRole) && req.user.profileType !== 'both') {
      return sendError(res, 403, 'Access denied. Insufficient permissions');
    }
    
    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Continue without authentication
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
