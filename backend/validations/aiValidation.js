const { body } = require('express-validator');

const chatValidation = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 1200 })
    .withMessage('Message must be between 1 and 1200 characters'),

  body('sessionId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('sessionId must be between 1 and 100 characters'),

  body('context')
    .optional()
    .isObject()
    .withMessage('context must be an object'),

  body('context.page')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('context.page must be at most 50 characters'),

  body('context.role')
    .optional()
    .trim()
    .isIn(['customer', 'business', 'both'])
    .withMessage('context.role must be customer, business, or both'),

  body('context.location')
    .optional()
    .trim()
    .isLength({ max: 80 })
    .withMessage('context.location must be at most 80 characters')
];

module.exports = {
  chatValidation,
};
