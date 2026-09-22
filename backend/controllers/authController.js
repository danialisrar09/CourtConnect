const { User, UserProfile, UserSession } = require('../models');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const { generateToken } = require('../utils/jwtUtils');
const { sendSuccess, sendError } = require('../utils/responseUtils');

/**
 * Register a new user
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, profileType, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 400, 'This email address is already registered');
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      profileType,
      phone,
      currentRole: profileType === 'both' ? 'customer' : profileType
    });
    
    // Create user profile
    await UserProfile.create({
      userId: user._id
    });
    
    // Generate token
    const token = generateToken({ 
      userId: user._id, 
      email: user.email,
      role: user.currentRole
    });
    
    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    await UserSession.create({
      userId: user._id,
      token,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      },
      expiresAt
    });
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Prepare response
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileType: user.profileType,
      currentRole: user.currentRole,
      phone: user.phone
    };
    
    return sendSuccess(res, 201, 'Registration successful', {
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return sendError(res, 500, 'Registration failed. Please try again');
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password, rememberMe, role } = req.body;
    
    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      return sendError(res, 401, 'Your account has been deactivated');
    }
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return sendError(res, 401, 'Invalid email or password');
    }
    
    // Validate role if provided
    if (role) {
      if (user.profileType === 'both') {
        // Users with 'both' can login as either customer or business
        if (role !== 'customer' && role !== 'business') {
          return sendError(res, 400, 'Invalid role specified');
        }
        user.currentRole = role;
      } else {
        // Single-role users must login with their assigned role
        if (role !== user.profileType) {
          return sendError(res, 403, `This account is registered as ${user.profileType}. Please select the correct account type.`);
        }
        user.currentRole = user.profileType;
      }
    } else {
      // If no role specified, use default
      user.currentRole = user.profileType === 'both' ? 'customer' : user.profileType;
    }
    
    // Generate token
    const token = generateToken({ 
      userId: user._id, 
      email: user.email,
      role: user.currentRole
    });
    
    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7)); // 30 days if remember me
    
    await UserSession.create({
      userId: user._id,
      token,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      },
      expiresAt
    });
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Prepare response
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileType: user.profileType,
      currentRole: user.currentRole,
      phone: user.phone
    };
    
    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Login failed. Please try again');
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const token = req.token;
    
    // Deactivate session
    await UserSession.findOneAndUpdate(
      { token },
      { isActive: false }
    );
    
    return sendSuccess(res, 200, 'Logout successful');
    
  } catch (error) {
    console.error('Logout error:', error);
    return sendError(res, 500, 'Logout failed');
  }
};

/**
 * Switch user profile (customer <-> business)
 * @route POST /api/auth/switch-profile
 */
const switchProfile = async (req, res) => {
  try {
    const { role } = req.body;
    const user = req.user;
    
    // Check if user has dual roles
    if (user.profileType !== 'both') {
      return sendError(res, 403, 'You do not have permission to switch profiles');
    }
    
    // Update current role
    user.currentRole = role;
    await user.save();
    
    // Generate new token with updated role
    const token = generateToken({ 
      userId: user._id, 
      email: user.email,
      role: role
    });
    
    // Update session token
    await UserSession.findOneAndUpdate(
      { token: req.token },
      { token, lastActivity: new Date() }
    );
    
    return sendSuccess(res, 200, 'Profile switched successfully', {
      currentRole: role,
      token
    });
    
  } catch (error) {
    console.error('Switch profile error:', error);
    return sendError(res, 500, 'Failed to switch profile');
  }
};

/**
 * Verify token
 * @route GET /api/auth/verify
 */
const verifyToken = async (req, res) => {
  try {
    const user = req.user;
    
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileType: user.profileType,
      currentRole: user.currentRole,
      phone: user.phone
    };
    
    return sendSuccess(res, 200, 'Token is valid', { user: userData });
    
  } catch (error) {
    console.error('Verify token error:', error);
    return sendError(res, 401, 'Invalid token');
  }
};

module.exports = {
  register,
  login,
  logout,
  switchProfile,
  verifyToken
};
