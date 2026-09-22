const { body, param, query } = require('express-validator');

const ratingField = body('rating')
  .notEmpty().withMessage('Rating is required')
  .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5');

const commentField = body('comment')
  .optional()
  .isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters');

const addReviewValidation = [
  param('venueId').isMongoId().withMessage('Invalid venue ID'),
  ratingField,
  commentField,
  body('bookingId')
    .optional()
    .isMongoId().withMessage('Invalid booking ID')
];

const updateReviewValidation = [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters')
];

const getVenueReviewsValidation = [
  param('venueId').isMongoId().withMessage('Invalid venue ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('sort').optional().isIn(['recent', 'rating', 'helpful']).withMessage('Invalid sort option')
];

const respondValidation = [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('text')
    .notEmpty().withMessage('Response text is required')
    .isLength({ min: 5, max: 500 }).withMessage('Response must be 5-500 characters')
];

module.exports = {
  addReviewValidation,
  updateReviewValidation,
  getVenueReviewsValidation,
  respondValidation
};
