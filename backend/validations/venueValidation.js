const { body, query } = require('express-validator');
const Venue = require('../models/Venue');

const timeRegex = /^\d{2}:\d{2}$/; // HH:mm

const createVenueValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters'),

  body('description')
    .optional()
    .trim(),

  body('sport')
    .notEmpty().withMessage('Sport is required')
    .isIn(Venue.SPORT_TYPES).withMessage('Invalid sport type'),

  body('hourlyPrice')
    .notEmpty().withMessage('Hourly price is required')
    .isFloat({ gt: 0 }).withMessage('Hourly price must be greater than 0'),

  body('capacity')
    .optional()
    .isInt({ gt: 0 }).withMessage('Capacity must be a positive integer'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters'),

  body('coordinates')
    .optional()
    .isObject().withMessage('Coordinates must be an object with lat and lng'),

  body('coordinates.lat')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('coordinates.lat must be between -90 and 90'),

  body('coordinates.lng')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('coordinates.lng must be between -180 and 180'),

  body('coordinates')
    .custom((value, { req }) => {
      const hasLat = req.body?.coordinates && Object.prototype.hasOwnProperty.call(req.body.coordinates, 'lat');
      const hasLng = req.body?.coordinates && Object.prototype.hasOwnProperty.call(req.body.coordinates, 'lng');
      if (hasLat !== hasLng) {
        throw new Error('Both coordinates.lat and coordinates.lng are required together');
      }
      return true;
    }),

  body('amenities')
    .optional()
    .isArray().withMessage('Amenities must be an array')
    .custom(arr => arr.every(a => Venue.AMENITIES.includes(a)))
    .withMessage('Invalid amenity provided'),

  body('images')
    .isArray({ min: 1 }).withMessage('At least one image is required')
    .custom(arr => arr.every(img => typeof img === 'string' && img.length > 0))
    .withMessage('Each image must be a non-empty string'),

  body('availability')
    .optional()
    .isArray().withMessage('Availability must be an array')
    .custom(list => {
      const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      return list.every(item => {
        if (!item || typeof item !== 'object') return false;
        const { day, enabled, startTime, endTime } = item;
        if (!days.includes(day)) return false;
        if (typeof enabled !== 'boolean') return false;
        if (enabled) {
          if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return false;
          if (startTime >= endTime) return false;
        }
        return true;
      });
    }).withMessage('Invalid availability entries')
];

const updateVenueValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters'),

  body('description')
    .optional()
    .trim(),

  body('sport')
    .optional()
    .isIn(Venue.SPORT_TYPES).withMessage('Invalid sport type'),

  body('hourlyPrice')
    .optional()
    .isFloat({ gt: 0 }).withMessage('Hourly price must be greater than 0'),

  body('capacity')
    .optional()
    .isInt({ gt: 0 }).withMessage('Capacity must be a positive integer'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters'),

  body('coordinates')
    .optional()
    .isObject().withMessage('Coordinates must be an object with lat and lng'),

  body('coordinates.lat')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('coordinates.lat must be between -90 and 90'),

  body('coordinates.lng')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('coordinates.lng must be between -180 and 180'),

  body('coordinates')
    .custom((value, { req }) => {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'coordinates')) {
        return true;
      }

      const coords = req.body.coordinates;
      if (!coords || typeof coords !== 'object') {
        throw new Error('Coordinates must be an object with lat and lng');
      }

      const hasLat = Object.prototype.hasOwnProperty.call(coords, 'lat');
      const hasLng = Object.prototype.hasOwnProperty.call(coords, 'lng');

      if (hasLat !== hasLng) {
        throw new Error('Both coordinates.lat and coordinates.lng are required together');
      }

      return true;
    }),

  body('amenities')
    .optional()
    .isArray().withMessage('Amenities must be an array')
    .custom(arr => arr.every(a => Venue.AMENITIES.includes(a)))
    .withMessage('Invalid amenity provided'),

  body('images')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one image is required')
    .custom(arr => arr.every(img => typeof img === 'string' && img.length > 0))
    .withMessage('Each image must be a non-empty string'),

  body('availability')
    .optional()
    .isArray().withMessage('Availability must be an array')
    .custom(list => {
      const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      return list.every(item => {
        if (!item || typeof item !== 'object') return false;
        const { day, enabled, startTime, endTime } = item;
        if (!days.includes(day)) return false;
        if (typeof enabled !== 'boolean') return false;
        if (enabled) {
          if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return false;
          if (startTime >= endTime) return false;
        }
        return true;
      });
    }).withMessage('Invalid availability entries')
];

const viewportVenuesValidation = [
  query('north')
    .notEmpty().withMessage('north is required')
    .isFloat({ min: -90, max: 90 }).withMessage('north must be between -90 and 90'),

  query('south')
    .notEmpty().withMessage('south is required')
    .isFloat({ min: -90, max: 90 }).withMessage('south must be between -90 and 90'),

  query('east')
    .notEmpty().withMessage('east is required')
    .isFloat({ min: -180, max: 180 }).withMessage('east must be between -180 and 180'),

  query('west')
    .notEmpty().withMessage('west is required')
    .isFloat({ min: -180, max: 180 }).withMessage('west must be between -180 and 180'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),

  query('north')
    .custom((value, { req }) => {
      const north = parseFloat(value);
      const south = parseFloat(req.query.south);
      if (!Number.isNaN(north) && !Number.isNaN(south) && north <= south) {
        throw new Error('north must be greater than south');
      }
      return true;
    }),
];

const nearbyVenuesValidation = [
  query('lat')
    .notEmpty().withMessage('lat is required')
    .isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90'),

  query('lng')
    .notEmpty().withMessage('lng is required')
    .isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),

  query('radiusKm')
    .optional()
    .isFloat({ gt: 0, lte: 50 }).withMessage('radiusKm must be > 0 and <= 50'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
];

const directionsValidation = [
  query('startLat')
    .notEmpty().withMessage('startLat is required')
    .isFloat({ min: -90, max: 90 }).withMessage('startLat must be between -90 and 90'),

  query('startLng')
    .notEmpty().withMessage('startLng is required')
    .isFloat({ min: -180, max: 180 }).withMessage('startLng must be between -180 and 180'),

  query('endLat')
    .notEmpty().withMessage('endLat is required')
    .isFloat({ min: -90, max: 90 }).withMessage('endLat must be between -90 and 90'),

  query('endLng')
    .notEmpty().withMessage('endLng is required')
    .isFloat({ min: -180, max: 180 }).withMessage('endLng must be between -180 and 180'),

  query('profile')
    .optional()
    .isIn(['driving', 'walking', 'cycling']).withMessage('profile must be driving, walking, or cycling'),
];

module.exports = {
  createVenueValidation,
  updateVenueValidation,
  viewportVenuesValidation,
  nearbyVenuesValidation,
  directionsValidation,
};
