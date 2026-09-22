const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const {
  createBookingValidation,
  updateBookingValidation,
  cancelBookingValidation,
  createPaymentIntentValidation,
  getBookingsValidation,
  checkAvailabilityValidation
} = require('../validations/bookingValidation');

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking
 * @access  Private (Customer only)
 */
router.post(
  '/',
  authenticate,
  createBookingValidation,
  handleValidationErrors,
  bookingController.createBooking
);

/**
 * @route   GET /api/bookings/my
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get(
  '/my',
  authenticate,
  getBookingsValidation,
  handleValidationErrors,
  bookingController.getMyBookings
);

/**
 * @route   GET /api/bookings/availability
 * @desc    Check availability for a venue on a specific date
 * @access  Public
 */
router.get(
  '/availability',
  checkAvailabilityValidation,
  handleValidationErrors,
  bookingController.checkAvailability
);

/**
 * @route   GET /api/bookings/stats
 * @desc    Get booking statistics for business owner
 * @access  Private (Business owner only)
 */
router.get(
  '/stats',
  authenticate,
  bookingController.getBookingStats
);

router.get(
  '/stats/monthly',
  authenticate,
  bookingController.getMonthlyBookingStats
);

/**
 * @route   GET /api/bookings/venue/:venueId
 * @desc    Get all bookings for a specific venue
 * @access  Private (Venue owner only)
 */
router.get(
  '/venue/:venueId',
  authenticate,
  getBookingsValidation,
  handleValidationErrors,
  bookingController.getVenueBookings
);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID
 * @access  Private (Owner or venue owner only)
 */
router.get(
  '/:id',
  authenticate,
  bookingController.getBookingById
);

/**
 * @route   PUT /api/bookings/:id
 * @desc    Update booking (status, payment, etc.)
 * @access  Private (Venue owner only)
 */
router.put(
  '/:id',
  authenticate,
  updateBookingValidation,
  handleValidationErrors,
  bookingController.updateBooking
);

/**
 * @route   POST /api/bookings/:id/payment-intent
 * @desc    Create Stripe payment intent for booking deposit (50%)
 * @access  Private (Booking customer only)
 */
router.post(
  '/:id/payment-intent',
  authenticate,
  createPaymentIntentValidation,
  handleValidationErrors,
  bookingController.createDepositPaymentIntent
);

/**
 * @route   POST /api/bookings/:id/deposit-checkout-session
 * @desc    Create Stripe Checkout session for booking deposit (50%)
 * @access  Private (Booking customer only)
 */
router.post(
  '/:id/deposit-checkout-session',
  authenticate,
  createPaymentIntentValidation,
  handleValidationErrors,
  bookingController.createDepositCheckoutSession
);

/**
 * @route   POST /api/bookings/:id/confirm-deposit-checkout
 * @desc    Confirm Stripe Checkout deposit status after redirect
 * @access  Private (Booking customer only)
 */
router.post(
  '/:id/confirm-deposit-checkout',
  authenticate,
  createPaymentIntentValidation,
  handleValidationErrors,
  bookingController.confirmDepositCheckoutSession
);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel a booking
 * @access  Private (Owner or venue owner)
 */
router.delete(
  '/:id',
  authenticate,
  cancelBookingValidation,
  handleValidationErrors,
  bookingController.cancelBooking
);

/**
 * @route   POST /api/bookings/:id/contact
 * @desc    Contact the customer for a booking
 * @access  Private (Venue owner only)
 */
router.post(
  '/:id/contact',
  authenticate,
  bookingController.contactCustomer
);

module.exports = router;
