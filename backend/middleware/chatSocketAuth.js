const { verifyToken } = require('../utils/jwtUtils');
const { User, UserSession } = require('../models');

const extractToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken && typeof authToken === 'string') {
    return authToken.startsWith('Bearer ') ? authToken.split(' ')[1] : authToken;
  }

  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('Socket authentication failed: token is required'));
    }

    const decoded = verifyToken(token);

    const session = await UserSession.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return next(new Error('Socket authentication failed: invalid or expired session'));
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new Error('Socket authentication failed: user not found or inactive'));
    }

    session.lastActivity = new Date();
    await session.save();

    socket.user = user;
    socket.session = session;
    socket.authToken = token;

    return next();
  } catch (error) {
    return next(new Error('Socket authentication failed: invalid token'));
  }
};

module.exports = {
  authenticateSocket,
};
