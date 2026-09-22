const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseUtils');

/**
 * Validation rules for user registration
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  body('profileType')
    .notEmpty().withMessage('Profile type is required')
    .isIn(['customer', 'business', 'both']).withMessage('Invalid profile type'),
  
  body('phone')
    .optional()
    .trim()
    .isMobilePhone().withMessage('Invalid phone number')
];

/**
 * Validation rules for user login
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for profile switch
 */
const switchProfileValidation = [
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['customer', 'business']).withMessage('Invalid role')
];

/**
 * Validation rules for profile update
 */
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  
  body('phone')
    .optional()
    .trim()
    .custom(value => {
      // Allow empty or whitespace-only values
      if (!value || value.length === 0) return true;
      // If provided, validate as phone number (basic pattern: digits, +, -, spaces)
      const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Invalid phone number format');
      }
      return true;
    })
];

/**
 * Validation rules for password change
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));
    
    return sendError(res, 400, 'Validation failed', formattedErrors);
  }
  
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  switchProfileValidation,
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors,
  validate: handleValidationErrors // Alias for consistency
};
