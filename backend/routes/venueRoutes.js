const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/authMiddleware');
const { mapLimiter } = require('../middleware/rateLimitMiddleware');
const { mapRequestLogger } = require('../middleware/mapRequestLogger');
const {
  createVenue,
  getTopVenues,
  getMyVenues,
  updateVenue,
  getVenueById,
  deleteVenue,
  getPublicVenues,
  getPublicVenueById,
  getSportStats,
  getVenueLocations,
  getViewportVenues,
  getNearbyVenues,
  getDirections,
} = require('../controllers/venueController');
const {
  createVenueValidation,
  updateVenueValidation,
  viewportVenuesValidation,
  nearbyVenuesValidation,
  directionsValidation,
} = require('../validations/venueValidation');
const { handleValidationErrors } = require('../middleware/validationMiddleware');

// Create a new venue (Business only)
router.post(
  '/',
  authenticate,
  authorize('business'),
  createVenueValidation,
  handleValidationErrors,
  createVenue
);

// Public/browse venues with filters + pagination
router.get(
  '/',
  optionalAuth,
  getPublicVenues
);

// Public venue detail
router.get(
  '/public/:id',
  optionalAuth,
  getPublicVenueById
);

// Map viewport venues (public)
router.get(
  '/map/viewport',
  mapRequestLogger,
  mapLimiter,
  viewportVenuesValidation,
  handleValidationErrors,
  getViewportVenues
);

// Nearby venues (public)
router.get(
  '/map/nearby',
  mapRequestLogger,
  mapLimiter,
  nearbyVenuesValidation,
  handleValidationErrors,
  getNearbyVenues
);

// Directions proxy (public)
router.get(
  '/map/directions',
  mapRequestLogger,
  mapLimiter,
  directionsValidation,
  handleValidationErrors,
  getDirections
);

// Sport statistics (public)
router.get(
  '/stats/sports',
  getSportStats
);

// Distinct public venue locations for UI filters
router.get(
  '/locations',
  optionalAuth,
  getVenueLocations
);

// Top performing venues (Business only)
router.get(
  '/top',
  authenticate,
  authorize('business'),
  getTopVenues
);

// My venues (Business only)
router.get(
  '/my',
  authenticate,
  authorize('business'),
  getMyVenues
);

// Update venue (Business only, owner)
router.put(
  '/:id',
  authenticate,
  authorize('business'),
  updateVenueValidation,
  handleValidationErrors,
  updateVenue
);

// Delete venue (Business only, owner)
router.delete(
  '/:id',
  authenticate,
  authorize('business'),
  deleteVenue
);

// Get one venue (Business only, owner)
router.get(
  '/:id',
  authenticate,
  authorize('business'),
  getVenueById
);

module.exports = router;
