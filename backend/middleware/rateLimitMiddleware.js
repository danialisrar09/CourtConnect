const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 500 requests per 15 minutes (increased for development)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Auth route rate limiter (stricter)
 * 20 requests per 15 minutes (increased for development)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Registration rate limiter
 * 3 registrations per hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Too many accounts created from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Map endpoint rate limiter
 * 180 requests per 15 minutes per IP
 */
const mapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  message: {
    success: false,
    message: 'Too many map requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  mapLimiter
};
