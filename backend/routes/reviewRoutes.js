const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const reviewController = require('../controllers/reviewController');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const {
  addReviewValidation,
  updateReviewValidation,
  getVenueReviewsValidation,
  respondValidation
} = require('../validations/reviewValidation');

// Public: get reviews for a venue
router.get(
  '/venues/:venueId/reviews',
  getVenueReviewsValidation,
  handleValidationErrors,
  reviewController.getVenueReviews
);

// Auth: get unreviewed bookings for a venue
router.get(
  '/venues/:venueId/unreviewed-bookings',
  authenticate,
  reviewController.getUnreviewedBookings
);

// Public: get single review
router.get(
  '/reviews/:id',
  reviewController.getReviewById
);

// Auth: add review (must have completed booking)
router.post(
  '/venues/:venueId/reviews',
  authenticate,
  addReviewValidation,
  handleValidationErrors,
  reviewController.addReview
);

// Auth: update own review
router.put(
  '/reviews/:id',
  authenticate,
  updateReviewValidation,
  handleValidationErrors,
  reviewController.updateReview
);

// Auth: delete own review
router.delete(
  '/reviews/:id',
  authenticate,
  reviewController.deleteReview
);

// Auth: mark helpful toggle
router.post(
  '/reviews/:id/helpful',
  authenticate,
  reviewController.toggleHelpful
);

// Auth: respond to review (venue owner)
router.post(
  '/reviews/:id/respond',
  authenticate,
  respondValidation,
  handleValidationErrors,
  reviewController.respondToReview
);

module.exports = router;
